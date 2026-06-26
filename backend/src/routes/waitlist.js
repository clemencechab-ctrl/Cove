const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { authenticate, requireRole } = require('../middleware/auth');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/waitlist — inscription à la liste d'attente (public, pré-lancement).
// Le client laisse son email pour être prévenu à l'ouverture de la boutique.
router.post('/', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !emailRegex.test(String(email).trim())) {
            return res.status(400).json({ success: false, error: 'Email invalide' });
        }

        const result = await store.addWaitlistEmail(email);

        // On répond pareil que ce soit nouveau ou déjà inscrit (évite de divulguer
        // qui est déjà dans la liste, et reste rassurant pour le client).
        return res.json({
            success: true,
            already: !!result.already,
            message: result.already
                ? 'Tu es déjà inscrit, on te préviendra au lancement.'
                : 'Inscription confirmée, on te préviendra au lancement.'
        });
    } catch (error) {
        console.error('Erreur serveur:', error && error.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/waitlist — liste des inscrits (owner uniquement).
router.get('/', authenticate, requireRole('owner'), async (req, res) => {
    try {
        const list = await store.getWaitlist();
        res.json({ success: true, count: list.length, waitlist: list });
    } catch (error) {
        console.error('Erreur serveur:', error && error.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
