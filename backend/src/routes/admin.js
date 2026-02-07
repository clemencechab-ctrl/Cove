const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendOrderStatusUpdate } = require('../utils/email');

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

        // Envoyer email de notification pour les statuts pertinents
        if (['confirmed', 'shipped', 'delivered', 'cancelled'].includes(status) && order.customer?.email) {
            sendOrderStatusUpdate(order, status);
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CRUD Produits ============

// GET /api/admin/products - Liste tous les produits
router.get('/products', async (req, res) => {
    try {
        const products = await store.getProducts();
        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/products - Creer un produit
router.post('/products', async (req, res) => {
    try {
        const { name, price, category, description, image, stock } = req.body;

        if (!name || price === undefined || !category) {
            return res.status(400).json({
                success: false,
                error: 'Nom, prix et categorie sont requis'
            });
        }

        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({
                success: false,
                error: 'Le prix doit etre un nombre positif'
            });
        }

        const product = await store.createProduct({
            name,
            price,
            category,
            description: description || '',
            image: image || '',
            stock: stock !== undefined ? parseInt(stock) : 0
        });

        res.status(201).json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/products/:id - Modifier un produit
router.put('/products/:id', async (req, res) => {
    try {
        const { name, price, category, description, image, stock } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (price !== undefined) {
            if (typeof price !== 'number' || price < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Le prix doit etre un nombre positif'
                });
            }
            updates.price = price;
        }
        if (category !== undefined) updates.category = category;
        if (description !== undefined) updates.description = description;
        if (image !== undefined) updates.image = image;
        if (stock !== undefined) updates.stock = parseInt(stock);

        const product = await store.updateProduct(req.params.id, updates);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Produit non trouve'
            });
        }

        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/products/:id - Supprimer un produit
router.delete('/products/:id', async (req, res) => {
    try {
        const product = await store.deleteProduct(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Produit non trouve'
            });
        }

        res.json({ success: true, message: 'Produit supprime', product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ Messages de contact ============

// GET /api/admin/messages - Liste tous les messages de contact
router.get('/messages', async (req, res) => {
    try {
        const messages = await store.getContactMessages();
        res.json({
            success: true,
            count: messages.length,
            messages
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/messages/:id/status - Marquer un message comme lu/traite
router.put('/messages/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = ['new', 'read', 'replied', 'archived'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Statut invalide. Valeurs acceptees: ${validStatuses.join(', ')}`
            });
        }

        const message = await store.updateContactMessageStatus(req.params.id, status);

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message non trouve'
            });
        }

        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
