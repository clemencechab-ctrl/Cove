const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { sendOrderConfirmation, sendOrderNotificationToOwner } = require('../utils/email');

// URL publique pour les images (GitHub Pages)
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://clemencechab-ctrl.github.io/Cove';

// Versions carrees optimisees pour Stripe (640x640)
const STRIPE_IMAGES = {
    'image/t-shirt-front.JPG': 'image/t-shirt-front-stripe.jpg',
    'image/hoodie-front.JPG': 'image/hoodie-front-stripe.jpg'
};

function getStripeImage(image) {
    if (image.startsWith('http')) return image;
    const stripeVersion = STRIPE_IMAGES[image] || image;
    return `${PUBLIC_URL}/${stripeVersion}`;
}

// Initialiser Stripe si la cle est configuree
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Middleware optionnel pour récupérer l'utilisateur si connecté
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

        // Calculer la reduction
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

// POST /api/checkout/create-session - Creer une session Stripe Checkout
router.post('/create-session', optionalAuth, async (req, res) => {
    try {
        const { items, customer, shipping, promoCode } = req.body;

        // Validation
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Panier vide'
            });
        }

        // Verifier les produits et construire les line items
        const lineItems = [];
        let subtotal = 0;

        for (const item of items) {
            const product = await store.getProductById(item.id);

            if (!product) {
                return res.status(400).json({
                    success: false,
                    error: `Produit ${item.id} non trouve`
                });
            }

            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: product.name,
                        description: product.description,
                        images: [getStripeImage(product.image)]
                    },
                    unit_amount: Math.round(product.price * 100)
                },
                quantity: item.quantity
            });

            subtotal += product.price * item.quantity;
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

        // Ajouter les frais de livraison si necessaire
        const subtotalAfterDiscount = subtotal - discountAmount;
        if (subtotalAfterDiscount < 100) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Frais de livraison'
                    },
                    unit_amount: 590
                },
                quantity: 1
            });
        }

        // Si Stripe n'est pas configure, simuler le paiement
        if (!stripe) {
            const orderItems = [];
            for (const item of items) {
                const product = await store.getProductById(item.id);
                orderItems.push({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: item.quantity,
                    size: item.size || null,
                    image: product.image
                });
            }

            const shippingCost = subtotalAfterDiscount >= 100 ? 0 : 5.90;
            const orderData = {
                customer: {
                    email: customer?.email || 'demo@cove.com',
                    firstName: customer?.firstName || 'Demo',
                    lastName: customer?.lastName || 'User',
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
                total: subtotalAfterDiscount + shippingCost
            };

            // Associer à l'utilisateur connecté si disponible
            if (req.user) {
                orderData.userId = req.user.uid;
            }

            const order = await store.createOrder(orderData);

            // Mettre a jour le stock (par taille si applicable)
            for (const item of items) {
                await store.updateProductStock(item.id, item.quantity, item.size || null);
            }

            // Marquer comme paye (mode demo)
            await store.updateOrderPayment(order.id, {
                paymentIntentId: 'demo_' + Date.now()
            });

            // Envoyer email de confirmation (mode demo)
            const fullOrder = { ...order, ...orderData, status: 'paid' };
            sendOrderConfirmation(fullOrder);
            sendOrderNotificationToOwner(fullOrder);

            // Incrementer l'utilisation du code promo
            if (appliedPromo) {
                await store.incrementPromoCodeUses(appliedPromo.code);
            }

            return res.json({
                success: true,
                mode: 'demo',
                message: 'Paiement simule (Stripe non configure)',
                order: {
                    orderNumber: order.orderNumber,
                    total: order.total
                },
                redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success.html?success=true&order=${order.orderNumber}`
            });
        }

        // Creer la commande en DB avant de rediriger vers Stripe
        const orderItems = [];
        for (const item of items) {
            const product = await store.getProductById(item.id);
            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                size: item.size || null,
                image: product.image
            });
        }

        const stripeShippingCost = subtotalAfterDiscount >= 100 ? 0 : 5.90;
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
            shippingCost: stripeShippingCost,
            total: subtotalAfterDiscount + stripeShippingCost
        };

        if (req.user) {
            orderData.userId = req.user.uid;
        }

        const order = await store.createOrder(orderData);

        // Incrementer l'utilisation du code promo
        if (appliedPromo) {
            await store.incrementPromoCodeUses(appliedPromo.code);
        }

        // Decrementer le stock (par taille si applicable)
        for (const item of items) {
            await store.updateProductStock(item.id, item.quantity, item.size || null);
        }

        // Creer la session Stripe Checkout
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/success.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/success.html?canceled=true`,
            customer_email: customer?.email,
            metadata: {
                orderId: String(order.id),
                orderNumber: order.orderNumber
            }
        };

        // Appliquer la reduction via un coupon Stripe si applicable
        if (discountAmount > 0 && appliedPromo) {
            const coupon = await stripe.coupons.create({
                amount_off: Math.round(discountAmount * 100),
                currency: 'eur',
                duration: 'once',
                name: `Reduction ${appliedPromo.code}`
            });
            sessionParams.discounts = [{ coupon: coupon.id }];
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url,
            orderNumber: order.orderNumber
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/checkout/verify - Verifier le statut d'un paiement
router.post('/verify', async (req, res) => {
    try {
        const { sessionId, orderNumber } = req.body;

        // Mode demo
        if (orderNumber) {
            const order = await store.getOrderByNumber(orderNumber);
            if (order) {
                return res.json({
                    success: true,
                    paid: order.status === 'paid',
                    order: {
                        orderNumber: order.orderNumber,
                        total: order.total,
                        status: order.status
                    }
                });
            }
        }

        // Verifier avec Stripe
        if (!stripe || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID manquant'
            });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Backup idempotent du webhook : mettre a jour la commande si payee
        if (session.payment_status === 'paid' && session.metadata?.orderId) {
            const order = await store.getOrderById(session.metadata.orderId);
            const alreadyPaid = order && order.status === 'paid';

            await store.updateOrderPayment(session.metadata.orderId, {
                paymentIntentId: session.payment_intent
            });

            // Envoyer les emails si pas deja envoyes (premiere verification)
            if (!alreadyPaid && order) {
                const fullOrder = { ...order, status: 'paid' };
                sendOrderConfirmation(fullOrder);
                sendOrderNotificationToOwner(fullOrder);
            }
        }

        const stripeOrderNumber = session.metadata?.orderNumber || null;

        res.json({
            success: true,
            paid: session.payment_status === 'paid',
            orderNumber: stripeOrderNumber,
            session: {
                id: session.id,
                status: session.payment_status,
                customerEmail: session.customer_email
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
