const express = require('express');
const router = express.Router();
const store = require('../data/store');

// POST /api/orders - Creer une commande
router.post('/', async (req, res) => {
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

        // Creer la commande
        const order = await store.createOrder({
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
        });

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

module.exports = router;
