const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { sendOrderConfirmation, sendOrderNotificationToOwner } = require('../utils/email');

// POST /api/webhooks/stripe - Webhook Stripe checkout.session.completed
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        return res.status(400).json({ error: 'Signature ou secret manquant' });
    }

    let event;
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook Stripe: signature invalide:', err.message);
        return res.status(400).json({ error: 'Signature invalide' });
    }

    console.log(`Webhook Stripe recu: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        if (session.payment_status === 'paid' && session.metadata?.orderId) {
            const { orderId, orderNumber } = session.metadata;

            try {
                const order = await store.getOrderById(orderId);
                if (order && order.status === 'paid') {
                    console.log(`Webhook Stripe: commande ${orderNumber} deja marquee comme payee`);
                    return res.json({ received: true });
                }

                await store.updateOrderPayment(orderId, {
                    paymentIntentId: session.payment_intent
                });

                console.log(`Webhook Stripe: commande ${orderNumber} marquee comme payee`);

                const fullOrder = await store.getOrderById(orderId);
                if (fullOrder) {
                    sendOrderConfirmation(fullOrder);
                    sendOrderNotificationToOwner(fullOrder);
                }
            } catch (err) {
                console.error(`Webhook Stripe: erreur lors de la mise a jour de ${orderNumber}:`, err.message);
            }
        }
    }

    // Toujours repondre 200 pour eviter les retries Stripe
    res.json({ received: true });
});

module.exports = router;
