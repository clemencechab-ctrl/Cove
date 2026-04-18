// One-shot script: promote test-owner to 'owner' role on prod Firebase RTDB.
// Run with: node tests/set-owner-role.js
const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

(async () => {
    try {
        const user = await admin.auth().getUserByEmail('test-owner@cove-test.com');
        await admin.database().ref(`users/${user.uid}/role`).set('owner');
        const check = await admin.database().ref(`users/${user.uid}/role`).once('value');
        console.log(`OK - uid=${user.uid} role=${check.val()}`);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
