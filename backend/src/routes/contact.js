const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { sendContactNotification } = require('../utils/email');
const { authenticate, requireRole } = require('../middleware/auth');

// POST /api/contact - Envoyer un message de contact
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Nom, email et message sont requis'
            });
        }

        // Validation email basique
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Email invalide'
            });
        }

        // Stocker le message dans Firebase
        const contactMessage = await store.createContactMessage({
            name,
            email,
            subject: subject || 'Sans sujet',
            message
        });

        // Envoyer les emails via le module centralise
        const emailSent = await sendContactNotification({ name, email, subject, message });
        contactMessage.emailSent = emailSent;

        res.json({
            success: true,
            message: 'Message envoye avec succes',
            emailSent
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/contact/messages - Liste des messages (admin only)
router.get('/messages', authenticate, requireRole('owner'), async (req, res) => {
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

module.exports = router;
