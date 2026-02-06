const express = require('express');
const router = express.Router();
const store = require('../data/store');

// POST /api/webhooks/stripe
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('STRIPE_WEBHOOK_SECRET not configured, skipping webhook verification');
        return res.status(400).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const orderId = session.metadata?.orderId;
            const orderNumber = session.metadata?.orderNumber;

            if (orderId && session.payment_status === 'paid') {
                try {
                    await store.updateOrderPayment(orderId, {
                        paymentIntentId: session.payment_intent
                    });
                    console.log(`Webhook: Order ${orderNumber} marked as paid`);
                    // TODO Phase 6: envoyer email de confirmation
                } catch (err) {
                    console.error(`Webhook: Failed to update order ${orderNumber}:`, err.message);
                }
            }
            break;
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            console.log(`Webhook: Payment failed for intent ${paymentIntent.id}`);
            break;
        }

        default:
            console.log(`Webhook: Unhandled event type ${event.type}`);
    }

    // Toujours repondre 200 pour eviter les retries Stripe
    res.json({ received: true });
});

module.exports = router;
