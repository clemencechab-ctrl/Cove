const admin = require('firebase-admin');
const path = require('path');

let credential;
const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountEnv) {
    const val = serviceAccountEnv.trim();
    if (val.startsWith('{')) {
        // JSON inline
        credential = admin.credential.cert(JSON.parse(val));
    } else if (/^[A-Za-z0-9+/]+=*$/.test(val) && val.length > 100) {
        // Base64 encodé (Cloud Run)
        const decoded = Buffer.from(val, 'base64').toString('utf8');
        credential = admin.credential.cert(JSON.parse(decoded));
    } else {
        // Chemin de fichier relatif au dossier backend/
        credential = admin.credential.cert(path.resolve(__dirname, '..', '..', val));
    }
} else {
    const serviceAccountPath = path.join(__dirname, '..', '..', '..', 'covestudio-firebase-adminsdk-fbsvc-854611e7e9.json');
    credential = admin.credential.cert(serviceAccountPath);
}

admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = admin.database();

module.exports = { admin, db };
