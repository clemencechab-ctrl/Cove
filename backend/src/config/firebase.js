const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', '..', '..', 'covestudio-firebase-adminsdk-fbsvc-854611e7e9.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = admin.database();

module.exports = { admin, db };
