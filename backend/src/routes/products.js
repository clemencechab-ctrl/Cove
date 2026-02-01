const express = require('express');
const router = express.Router();
const store = require('../data/store');

// GET /api/products - Liste tous les produits
router.get('/', async (req, res) => {
    try {
        let products;

        const { category } = req.query;
        if (category && category !== 'all') {
            products = await store.getProductsByCategory(category);
        } else {
            products = await store.getProducts();
        }

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/products/:id - Detail d'un produit
router.get('/:id', async (req, res) => {
    try {
        const product = await store.getProductById(req.params.id);

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

// GET /api/products/category/:category - Produits par categorie
router.get('/category/:category', async (req, res) => {
    try {
        const products = await store.getProductsByCategory(req.params.category);

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
