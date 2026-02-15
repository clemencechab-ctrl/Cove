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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        // Toujours forcer le role client (securite)
        const userRole = 'client';

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

// POST /api/users/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email requis' });
        }

        // Use Firebase Auth REST API to send password reset email
        const resetRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestType: 'PASSWORD_RESET',
                    email
                })
            }
        );

        const resetData = await resetRes.json();

        if (!resetRes.ok) {
            // Don't reveal if email exists or not for security
            return res.json({ success: true, message: 'Si cet email existe, un lien de reinitialisation a ete envoye.' });
        }

        res.json({ success: true, message: 'Si cet email existe, un lien de reinitialisation a ete envoye.' });
    } catch (error) {
        console.error('Forgot password error:', error.message);
        // Don't reveal errors for security
        res.json({ success: true, message: 'Si cet email existe, un lien de reinitialisation a ete envoye.' });
    }
});

// POST /api/users/google-auth - Authentification via Google
router.post('/google-auth', async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Token requis' });
        }

        // Verifier le Firebase ID token
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid;
        const email = decoded.email;

        // Creer ou recuperer l'utilisateur en base
        let userProfile = await store.getUserByUid(uid);

        if (!userProfile) {
            // Nouveau utilisateur via Google - toujours client
            userProfile = await store.createUser(uid, {
                email,
                role: 'client'
            });
        } else {
            await store.updateLastLogin(uid);
        }

        res.json({
            message: 'Connexion Google reussie',
            user: { uid, ...userProfile },
            idToken
        });
    } catch (error) {
        console.error('Google auth error:', error.message);
        res.status(401).json({ error: 'Token Google invalide' });
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

// PUT /api/users/me (protected)
router.put('/me', authenticate, async (req, res) => {
    try {
        const { firstName, lastName, phone, shippingAddress } = req.body;

        const updates = {};
        if (firstName !== undefined) updates.firstName = String(firstName).trim();
        if (lastName !== undefined) updates.lastName = String(lastName).trim();
        if (phone !== undefined) updates.phone = String(phone).trim();
        if (shippingAddress !== undefined) {
            updates.shippingAddress = {
                address: String(shippingAddress.address || '').trim(),
                city: String(shippingAddress.city || '').trim(),
                postalCode: String(shippingAddress.postalCode || '').trim(),
                country: String(shippingAddress.country || '').trim()
            };
        }

        const updatedProfile = await store.updateUser(req.user.uid, updates);

        res.json({
            success: true,
            message: 'Profil mis à jour',
            user: { uid: req.user.uid, ...updatedProfile }
        });
    } catch (error) {
        console.error('Update profile error:', error.message);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
});

module.exports = router;
