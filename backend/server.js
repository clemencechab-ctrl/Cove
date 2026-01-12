require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const productRoutes = require('./src/routes/products');
const orderRoutes = require('./src/routes/orders');
const checkoutRoutes = require('./src/routes/checkout');
const contactRoutes = require('./src/routes/contact');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Parse JSON (sauf pour les webhooks Stripe qui ont besoin du raw body)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/webhooks/stripe') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/contact', contactRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'COVE Backend is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║     COVE Backend Server Started       ║
    ╠═══════════════════════════════════════╣
    ║  Local:   http://localhost:${PORT}        ║
    ║  API:     http://localhost:${PORT}/api    ║
    ║  Health:  http://localhost:${PORT}/api/health
    ╚═══════════════════════════════════════╝
    `);
});
