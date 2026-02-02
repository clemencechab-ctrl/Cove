const express = require('express');
const fetch = require('node-fetch');
const { admin } = require('../config/firebase');
const store = require('../data/store');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// POST /api/users/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        const allowedRoles = ['client', 'owner'];
        const userRole = allowedRoles.includes(role) ? role : 'client';

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password
        });

        // Create user profile in RTDB
        const userProfile = await store.createUser(userRecord.uid, {
            email,
            role: userRole
        });

        // Sign in to get an ID token via REST API
        const signInRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            }
        );

        const signInData = await signInRes.json();

        if (!signInRes.ok) {
            // User was created but sign-in failed — still return success
            return res.status(201).json({
                message: 'Compte créé avec succès',
                user: { uid: userRecord.uid, ...userProfile }
            });
        }

        res.status(201).json({
            message: 'Compte créé avec succès',
            user: { uid: userRecord.uid, ...userProfile },
            idToken: signInData.idToken,
            refreshToken: signInData.refreshToken,
            expiresIn: signInData.expiresIn
        });
    } catch (error) {
        console.error('Register error:', error.code, error.message);

        if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }
        if (error.code === 'auth/invalid-email') {
            return res.status(400).json({ error: 'Email invalide' });
        }

        res.status(500).json({ error: 'Erreur lors de la création du compte' });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Authenticate via Firebase Auth REST API
        const signInRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            }
        );

        const signInData = await signInRes.json();

        if (!signInRes.ok) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Update lastLogin in RTDB
        const uid = signInData.localId;
        await store.updateLastLogin(uid);

        // Get user profile
        const userProfile = await store.getUserByUid(uid);

        res.json({
            message: 'Connexion réussie',
            user: { uid, ...userProfile },
            idToken: signInData.idToken,
            refreshToken: signInData.refreshToken,
            expiresIn: signInData.expiresIn
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// GET /api/users/me (protected)
router.get('/me', authenticate, async (req, res) => {
    try {
        const userProfile = await store.getUserByUid(req.user.uid);

        if (!userProfile) {
            return res.status(404).json({ error: 'Profil utilisateur introuvable' });
        }

        res.json({
            uid: req.user.uid,
            ...userProfile
        });
    } catch (error) {
        console.error('Get profile error:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
});

module.exports = router;
