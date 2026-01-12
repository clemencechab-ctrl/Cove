const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Configurer le transporteur email (si configuré)
let transporter = null;
if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

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

        // Envoyer l'email si configuré
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_FROM || 'contact@cove.com',
                    to: process.env.EMAIL_USER,
                    replyTo: email,
                    subject: `[COVE Contact] ${subject || 'Nouveau message'}`,
                    html: `
                        <h2>Nouveau message de contact</h2>
                        <p><strong>Nom:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Sujet:</strong> ${subject || 'Non specifie'}</p>
                        <p><strong>Message:</strong></p>
                        <p>${message.replace(/\n/g, '<br>')}</p>
                        <hr>
                        <p><small>Message envoye depuis le site COVE</small></p>
                    `
                });

                // Envoyer une confirmation au client
                await transporter.sendMail({
                    from: process.env.EMAIL_FROM || 'contact@cove.com',
                    to: email,
                    subject: 'COVE - Nous avons bien recu votre message',
                    html: `
                        <h2>Merci pour votre message !</h2>
                        <p>Bonjour ${name},</p>
                        <p>Nous avons bien recu votre message et nous vous repondrons dans les plus brefs delais.</p>
                        <p>Voici un recapitulatif de votre message :</p>
                        <blockquote style="border-left: 3px solid #ccc; padding-left: 15px; margin: 20px 0;">
                            ${message.replace(/\n/g, '<br>')}
                        </blockquote>
                        <p>A bientot,<br>L'equipe COVE</p>
                    `
                });

                contactMessage.emailSent = true;
            } catch (emailError) {
                console.error('Email error:', emailError);
                contactMessage.emailSent = false;
            }
        }

        res.json({
            success: true,
            message: 'Message envoye avec succes',
            emailSent: !!transporter
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
