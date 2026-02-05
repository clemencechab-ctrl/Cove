const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { authenticate } = require('../middleware/auth');

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

// POST /api/orders - Creer une commande
router.post('/', optionalAuth, async (req, res) => {
    try {
        const { customer, items, shipping } = req.body;

        // Validation
        if (!customer || !customer.email || !customer.firstName || !customer.lastName) {
            return res.status(400).json({
                success: false,
                error: 'Informations client manquantes'
            });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Panier vide'
            });
        }

        // Verifier les produits et calculer le total
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await store.getProductById(item.id);

            if (!product) {
                return res.status(400).json({
                    success: false,
                    error: `Produit ${item.id} non trouve`
                });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Stock insuffisant pour ${product.name}`
                });
            }

            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                image: product.image
            });

            subtotal += product.price * item.quantity;
        }

        // Calculer les frais de livraison
        const shippingCost = subtotal >= 100 ? 0 : 5.90;
        const total = subtotal + shippingCost;

        // Préparer les données de commande
        const orderData = {
            customer: {
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone || ''
            },
            shipping: {
                address: shipping?.address || '',
                city: shipping?.city || '',
                postalCode: shipping?.postalCode || '',
                country: shipping?.country || 'FR'
            },
            items: orderItems,
            subtotal,
            shippingCost,
            total
        };

        // Associer à l'utilisateur connecté si disponible
        if (req.user) {
            orderData.userId = req.user.uid;
        }

        // Creer la commande
        const order = await store.createOrder(orderData);

        // Mettre a jour le stock
        for (const item of items) {
            await store.updateProductStock(item.id, item.quantity);
        }

        res.status(201).json({
            success: true,
            message: 'Commande creee avec succes',
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                total: order.total,
                status: order.status
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/orders/my-orders - Commandes de l'utilisateur connecte
// IMPORTANT: Cette route doit etre AVANT /:orderNumber
router.get('/my-orders', authenticate, async (req, res) => {
    try {
        const orders = await store.getOrdersByUserId(req.user.uid);

        res.json({
            success: true,
            count: orders.length,
            orders: orders.map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                status: o.status,
                total: o.total,
                items: o.items,
                createdAt: o.createdAt,
                statusHistory: o.statusHistory || []
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/orders/customer/:email - Commandes d'un client
router.get('/customer/:email', async (req, res) => {
    try {
        const orders = await store.getOrdersByEmail(req.params.email);

        res.json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/orders/:orderNumber - Detail d'une commande
router.get('/:orderNumber', async (req, res) => {
    try {
        const order = await store.getOrderByNumber(req.params.orderNumber);

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

// PUT /api/orders/:id/status - Mettre a jour le statut (admin)
router.put('/:id/status', authenticate, async (req, res) => {
    try {
        // Verifier que l'utilisateur est admin/owner
        if (req.user.role !== 'owner' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acces refuse'
            });
        }

        const { status, comment } = req.body;
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Statut invalide'
            });
        }

        const order = await store.updateOrderStatus(req.params.id, status, comment);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Commande non trouvee'
            });
        }

        res.json({
            success: true,
            message: 'Statut mis a jour',
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                statusHistory: order.statusHistory
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
