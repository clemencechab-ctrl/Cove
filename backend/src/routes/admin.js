const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { authenticate, requireRole } = require('../middleware/auth');

// Toutes les routes admin nécessitent une authentification et le rôle owner
router.use(authenticate);
router.use(requireRole('owner'));

// GET /api/admin/stats - Statistiques générales
router.get('/stats', async (req, res) => {
    try {
        const orders = await store.getOrders();
        const users = await store.getAllUsers();

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalClients = users.filter(u => u.role === 'client').length;

        res.json({
            success: true,
            stats: {
                totalOrders,
                totalRevenue,
                totalClients
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/clients - Liste tous les clients avec leurs commandes
router.get('/clients', async (req, res) => {
    try {
        const users = await store.getAllUsers();
        const orders = await store.getOrders();

        // Filtrer uniquement les clients (pas les owners/admins)
        const clients = users
            .filter(u => u.role === 'client')
            .map(user => {
                // Trouver les commandes de ce client
                const userOrders = orders
                    .filter(o => o.userId === user.uid)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map(o => ({
                        id: o.id,
                        orderNumber: o.orderNumber,
                        status: o.status,
                        total: o.total,
                        items: o.items,
                        createdAt: o.createdAt
                    }));

                return {
                    uid: user.uid,
                    email: user.email,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                    ordersCount: userOrders.length,
                    totalSpent: userOrders.reduce((sum, o) => sum + (o.total || 0), 0),
                    orders: userOrders
                };
            })
            .sort((a, b) => new Date(b.lastLogin || 0) - new Date(a.lastLogin || 0));

        res.json({
            success: true,
            count: clients.length,
            clients
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/orders - Retourne toutes les commandes
router.get('/orders', async (req, res) => {
    try {
        const orders = await store.getOrders();
        const sortedOrders = orders.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        res.json({ success: true, count: orders.length, orders: sortedOrders });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/orders/:id/status - Met à jour le statut d'une commande
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status, comment } = req.body;

        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}`
            });
        }

        const order = await store.updateOrderStatus(req.params.id, status, comment);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Commande non trouvée'
            });
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
