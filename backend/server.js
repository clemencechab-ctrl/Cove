require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const productRoutes = require('./src/routes/products');
const orderRoutes = require('./src/routes/orders');
const checkoutRoutes = require('./src/routes/checkout');
const contactRoutes = require('./src/routes/contact');
const adminRoutes = require('./src/routes/admin');
const userRoutes = require('./src/routes/users');
const webhookRoutes = require('./src/routes/webhooks');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// HTTP Logging
app.use(morgan('dev'));
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting general (100 req / 15 min)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requetes, veuillez reessayer plus tard' }
});

// Rate limiting strict pour auth (10 req / 15 min)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives, veuillez reessayer plus tard' }
});

app.use('/api/', generalLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', authLimiter);

// Parse JSON (sauf pour les webhooks Stripe qui ont besoin du raw body)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/webhooks/stripe') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'COVE Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Serve static frontend files
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// Fallback: serve index.html for non-API routes
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Route not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
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
