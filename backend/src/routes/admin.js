const express = require('express');
const router = express.Router();
const store = require('../data/store');

// GET /api/admin/orders - Retourne toutes les commandes
router.get('/orders', async (req, res) => {
    try {
        const orders = await store.getOrders();
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/orders/:id/status - Met a jour le statut d'une commande
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Statut invalide. Valeurs acceptees: ${validStatuses.join(', ')}`
            });
        }

        const order = await store.updateOrderStatus(req.params.id, status);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Commande non trouvee'
            });
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
