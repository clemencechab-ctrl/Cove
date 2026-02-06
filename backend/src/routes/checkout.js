const express = require('express');
const router = express.Router();
const store = require('../data/store');

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

// POST /api/checkout/create-session - Creer une session Stripe Checkout
router.post('/create-session', optionalAuth, async (req, res) => {
    try {
        const { items, customer, shipping } = req.body;

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
                        images: product.image.startsWith('http') ? [product.image] : []
                    },
                    unit_amount: Math.round(product.price * 100)
                },
                quantity: item.quantity
            });

            subtotal += product.price * item.quantity;
        }

        // Ajouter les frais de livraison si necessaire
        if (subtotal < 100) {
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
                    image: product.image
                });
            }

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
                shippingCost: subtotal >= 100 ? 0 : 5.90,
                total: subtotal + (subtotal >= 100 ? 0 : 5.90)
            };

            // Associer à l'utilisateur connecté si disponible
            if (req.user) {
                orderData.userId = req.user.uid;
            }

            const order = await store.createOrder(orderData);

            // Mettre a jour le stock
            for (const item of items) {
                await store.updateProductStock(item.id, item.quantity);
            }

            // Marquer comme paye (mode demo)
            await store.updateOrderPayment(order.id, {
                paymentIntentId: 'demo_' + Date.now()
            });

            return res.json({
                success: true,
                mode: 'demo',
                message: 'Paiement simule (Stripe non configure)',
                order: {
                    orderNumber: order.orderNumber,
                    total: order.total
                },
                redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cart.html?success=true&order=${order.orderNumber}`
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
                image: product.image
            });
        }

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
            shippingCost: subtotal >= 100 ? 0 : 5.90,
            total: subtotal + (subtotal >= 100 ? 0 : 5.90)
        };

        if (req.user) {
            orderData.userId = req.user.uid;
        }

        const order = await store.createOrder(orderData);

        // Decrementer le stock
        for (const item of items) {
            await store.updateProductStock(item.id, item.quantity);
        }

        // Creer la session Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/cart.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/cart.html?canceled=true`,
            customer_email: customer?.email,
            metadata: {
                orderId: String(order.id),
                orderNumber: order.orderNumber
            }
        });

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
            await store.updateOrderPayment(session.metadata.orderId, {
                paymentIntentId: session.payment_intent
            });
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
