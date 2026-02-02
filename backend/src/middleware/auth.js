const { admin } = require('../config/firebase');
const store = require('../data/store');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        const userProfile = await store.getUserByUid(decoded.uid);

        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            role: userProfile ? userProfile.role : 'client'
        };

        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        next();
    };
};

module.exports = { authenticate, requireRole };
