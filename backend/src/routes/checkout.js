const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { sendOrderConfirmation, sendOrderNotificationToOwner } = require('../utils/email');

// Middleware optionnel pour recuperer l'utilisateur si connecte
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const { admin } = require('../config/firebase');
        const decoded = await admin.auth().verifyIdToken(token);
        const userProfile = await store.getUserByUid(decoded.uid);
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            role: userProfile ? userProfile.role : 'client'
        };
    } catch (error) {
        // Token invalide, continuer sans utilisateur
    }
    next();
};

// POST /api/checkout/validate-promo - Valider un code promo
router.post('/validate-promo', async (req, res) => {
    try {
        const { code, subtotal } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, error: 'Code promo requis' });
        }

        const promo = await store.getPromoCodeByCode(code);

        if (!promo) {
            return res.status(404).json({ success: false, error: 'Code promo invalide' });
        }

        if (!promo.active) {
            return res.status(400).json({ success: false, error: 'Ce code promo n\'est plus actif' });
        }

        if (promo.maxUses > 0 && promo.currentUses >= promo.maxUses) {
            return res.status(400).json({ success: false, error: 'Ce code promo a atteint sa limite d\'utilisation' });
        }

        if (promo.minOrder > 0 && subtotal < promo.minOrder) {
            return res.status(400).json({
                success: false,
                error: `Commande minimum de ${promo.minOrder} EUR requise pour ce code`
            });
        }

        let discountAmount = 0;
        if (promo.type === 'percentage') {
            discountAmount = Math.round((subtotal * promo.value / 100) * 100) / 100;
        } else {
            discountAmount = Math.min(promo.value, subtotal);
        }

        res.json({
            success: true,
            discount: {
                code: promo.code,
                type: promo.type,
                value: promo.value,
                amount: discountAmount
            }
        });
    } catch (error) {
        console.error('Validate promo error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/checkout/create-session - Creer une session Stripe et retourner l'URL de checkout
router.post('/create-session', optionalAuth, async (req, res) => {
    try {
        const { items, customer, shipping, promoCode } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Panier vide' });
        }

        // Verifier les produits et calculer le sous-total
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await store.getProductById(item.id);
            if (!product) {
                return res.status(400).json({ success: false, error: `Produit ${item.id} non trouvé` });
            }
            subtotal += product.price * item.quantity;
            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                size: item.size || null,
                image: product.image
            });
        }

        // Valider et appliquer le code promo si fourni
        let discountAmount = 0;
        let appliedPromo = null;

        if (promoCode) {
            const promo = await store.getPromoCodeByCode(promoCode);
            if (promo && promo.active) {
                const withinUsageLimit = promo.maxUses === 0 || promo.currentUses < promo.maxUses;
                const meetsMinOrder = promo.minOrder === 0 || subtotal >= promo.minOrder;
                if (withinUsageLimit && meetsMinOrder) {
                    if (promo.type === 'percentage') {
                        discountAmount = Math.round((subtotal * promo.value / 100) * 100) / 100;
                    } else {
                        discountAmount = Math.min(promo.value, subtotal);
                    }
                    appliedPromo = promo;
                }
            }
        }

        const subtotalAfterDiscount = subtotal - discountAmount;
        const shippingCost = subtotalAfterDiscount >= 100 ? 0 : 5.90;
        const total = subtotalAfterDiscount + shippingCost;

        const orderData = {
            customer: {
                email: customer?.email || '',
                firstName: customer?.firstName || '',
                lastName: customer?.lastName || '',
                phone: customer?.phone || ''
            },
            shipping: {
                address: shipping?.address || '',
                city: shipping?.city || '',
                postalCode: shipping?.postalCode || '',
                country: shipping?.country || 'FR'
            },
            items: orderItems,
            subtotal,
            discountAmount,
            promoCode: appliedPromo ? appliedPromo.code : null,
            shippingCost,
            total
        };

        if (req.user) {
            orderData.userId = req.user.uid;
        }

        // Creer la commande dans Firebase
        const order = await store.createOrder(orderData);

        if (appliedPromo) {
            await store.incrementPromoCodeUses(appliedPromo.code);
        }

        // Decrementer le stock
        for (const item of items) {
            await store.updateProductStock(item.id, item.quantity, item.size || null);
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // Mode demo : Stripe non configure
        if (!process.env.STRIPE_SECRET_KEY) {
            await store.updateOrderPayment(order.id, {
                paymentIntentId: 'demo_' + Date.now()
            });

            const fullOrder = await store.getOrderById(order.id);
            sendOrderConfirmation(fullOrder);
            sendOrderNotificationToOwner(fullOrder);

            return res.json({
                success: true,
                mode: 'demo',
                url: `${frontendUrl}/success.html?order=${order.orderNumber}`,
                orderNumber: order.orderNumber
            });
        }

        // Creer la session Stripe
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        const lineItems = orderItems.map(item => ({
            price_data: {
                currency: 'eur',
                product_data: {
                    name: item.name,
                    images: [`${frontendUrl}/${item.image}`]
                },
                unit_amount: Math.round(item.price * 100)
            },
            quantity: item.quantity
        }));

        if (shippingCost > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: { name: 'Frais de livraison' },
                    unit_amount: Math.round(shippingCost * 100)
                },
                quantity: 1
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${frontendUrl}/success.html?order=${order.orderNumber}`,
            cancel_url: `${frontendUrl}/success.html?canceled=true`,
            customer_email: customer?.email || undefined,
            metadata: { orderId: order.id, orderNumber: order.orderNumber }
        });

        // Sauvegarder l'ID de session pour le fallback de verification
        await store.updateOrderStripeSession(order.id, session.id);

        res.json({
            success: true,
            url: session.url,
            orderNumber: order.orderNumber
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/checkout/verify - Verifier le statut d'une commande
// Verifie Firebase en premier, puis Stripe directement si le webhook n'est pas encore arrive
router.post('/verify', async (req, res) => {
    try {
        const { orderNumber } = req.body;

        if (!orderNumber) {
            return res.status(400).json({ success: false, error: 'Numero de commande requis' });
        }

        const order = await store.getOrderByNumber(orderNumber);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Commande introuvable' });
        }

        // Deja marque comme paye dans Firebase
        if (order.status === 'paid') {
            return res.json({
                success: true,
                paid: true,
                order: { orderNumber: order.orderNumber, total: order.total, status: 'paid' }
            });
        }

        // Fallback : verifier directement via Stripe si le webhook n'est pas encore arrive
        if (order.stripeSessionId && process.env.STRIPE_SECRET_KEY) {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

                if (session.payment_status === 'paid') {
                    await store.updateOrderPayment(order.id, {
                        paymentIntentId: session.payment_intent
                    });
                    const { sendOrderConfirmation, sendOrderNotificationToOwner } = require('../utils/email');
                    const fullOrder = await store.getOrderById(order.id);
                    if (fullOrder) {
                        sendOrderConfirmation(fullOrder);
                        sendOrderNotificationToOwner(fullOrder);
                    }
                    return res.json({
                        success: true,
                        paid: true,
                        order: { orderNumber: order.orderNumber, total: order.total, status: 'paid' }
                    });
                }
            } catch (stripeErr) {
                console.error('Verify fallback Stripe error:', stripeErr.message);
            }
        }

        res.json({
            success: true,
            paid: false,
            order: { orderNumber: order.orderNumber, total: order.total, status: order.status }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
