const express = require('express');
const router = express.Router();
const store = require('../data/store');

// GET /api/products - Liste tous les produits
router.get('/', (req, res) => {
    try {
        let products = store.getProducts();

        // Filtre par catégorie
        const { category } = req.query;
        if (category && category !== 'all') {
            products = store.getProductsByCategory(category);
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

// GET /api/products/:id - Détail d'un produit
router.get('/:id', (req, res) => {
    try {
        const product = store.getProductById(req.params.id);

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

// GET /api/products/category/:category - Produits par catégorie
router.get('/category/:category', (req, res) => {
    try {
        const products = store.getProductsByCategory(req.params.category);

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
