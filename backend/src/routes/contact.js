const express = require('express');
const router = express.Router();
const { sendContactNotification } = require('../utils/email');

// Stocker les messages en mémoire (pour le mode démo)
const messages = [];

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

        // Stocker le message
        const contactMessage = {
            id: Date.now(),
            name,
            email,
            subject: subject || 'Sans sujet',
            message,
            createdAt: new Date().toISOString(),
            status: 'new'
        };
        messages.push(contactMessage);

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

// GET /api/contact/messages - Liste des messages (admin)
router.get('/messages', (req, res) => {
    res.json({
        success: true,
        count: messages.length,
        messages: messages.reverse()
    });
});

module.exports = router;
