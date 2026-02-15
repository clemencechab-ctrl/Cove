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
        const totalRevenue = Math.round(orders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
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
                        trackingNumber: o.trackingNumber || null,
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

// PUT /api/admin/orders/:id/tracking - Ajouter un numero de suivi
router.put('/orders/:id/tracking', async (req, res) => {
    try {
        const { trackingNumber } = req.body;

        if (!trackingNumber || !trackingNumber.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Numero de suivi requis'
            });
        }

        const order = await store.updateOrderTracking(req.params.id, trackingNumber.trim());

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Commande non trouvee'
            });
        }

        // Envoyer email de notification avec le numero de suivi
        if (order.customer?.email) {
            sendOrderStatusUpdate({ ...order, trackingNumber: trackingNumber.trim() }, 'shipped');
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
        const { name, price, category, description, image, stock, sizeStock } = req.body;

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
            stock: stock !== undefined ? parseInt(stock) : 0,
            sizeStock: sizeStock || {}
        });

        res.status(201).json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/products/:id - Modifier un produit
router.put('/products/:id', async (req, res) => {
    try {
        const { name, price, category, description, image, stock, sizeStock } = req.body;

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
        if (sizeStock !== undefined) updates.sizeStock = sizeStock;

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

// ============ Codes Promo ============

// GET /api/admin/promo-codes - Liste tous les codes promo
router.get('/promo-codes', async (req, res) => {
    try {
        const promoCodes = await store.getPromoCodes();
        res.json({
            success: true,
            count: promoCodes.length,
            promoCodes
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/promo-codes - Creer un code promo
router.post('/promo-codes', async (req, res) => {
    try {
        const { code, type, value, minOrder, maxUses } = req.body;

        if (!code || !type || value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Code, type et valeur sont requis'
            });
        }

        if (!['percentage', 'fixed'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Type doit etre "percentage" ou "fixed"'
            });
        }

        if (typeof value !== 'number' || value <= 0) {
            return res.status(400).json({
                success: false,
                error: 'La valeur doit etre un nombre positif'
            });
        }

        if (type === 'percentage' && value > 100) {
            return res.status(400).json({
                success: false,
                error: 'Le pourcentage ne peut pas depasser 100'
            });
        }

        // Verifier que le code n'existe pas deja
        const existing = await store.getPromoCodeByCode(code);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Ce code promo existe deja'
            });
        }

        const promoCode = await store.createPromoCode({
            code,
            type,
            value,
            minOrder: minOrder || 0,
            maxUses: maxUses || 0
        });

        res.status(201).json({ success: true, promoCode });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/promo-codes/:id - Supprimer un code promo
router.delete('/promo-codes/:id', async (req, res) => {
    try {
        const promoCode = await store.deletePromoCode(req.params.id);

        if (!promoCode) {
            return res.status(404).json({
                success: false,
                error: 'Code promo non trouve'
            });
        }

        res.json({ success: true, message: 'Code promo supprime', promoCode });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
