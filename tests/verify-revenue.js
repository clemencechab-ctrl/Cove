// One-off : vérifie que /api/admin/stats.totalRevenue correspond à un recalcul
// indépendant depuis la RTDB (paidAt posé + status !== 'cancelled'), et détaille
// les cas limites (paidAt sans total, status paid sans paidAt, etc.)
const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const https = require('https');

const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const API_KEY = process.env.FIREBASE_API_KEY;
const OWNER_EMAIL = 'clemence.chab@gmail.com';
const PROD_URL = 'https://covestudio.fr';

function postJson(url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, res => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(chunks) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(chunks) }));
        }).on('error', reject);
    });
}

(async () => {
    try {
        // 1. Recalcul indépendant depuis la RTDB
        const snap = await admin.database().ref('orders').once('value');
        const data = snap.val() || {};
        const orders = Object.values(data);

        const paidNotCancelled = orders.filter(o => o.paidAt && o.status !== 'cancelled');
        const independentTotal = Math.round(paidNotCancelled.reduce((s, o) => s + (o.total || 0), 0) * 100) / 100;

        console.log(`Commandes totales en base : ${orders.length}`);
        console.log(`Commandes paidAt && !cancelled : ${paidNotCancelled.length}`);
        console.log(`CA recalculé indépendamment : ${independentTotal} EUR\n`);

        // Cas limites à signaler
        const paidNoTotal = paidNotCancelled.filter(o => typeof o.total !== 'number');
        if (paidNoTotal.length) {
            console.log(`⚠ ${paidNoTotal.length} commande(s) payée(s) sans "total" numérique :`, paidNoTotal.map(o => o.orderNumber));
        }
        const statusPaidNoPaidAt = orders.filter(o => o.status === 'paid' && !o.paidAt);
        if (statusPaidNoPaidAt.length) {
            console.log(`⚠ ${statusPaidNoPaidAt.length} commande(s) status=paid SANS paidAt (échapperaient au calcul) :`, statusPaidNoPaidAt.map(o => o.orderNumber));
        }
        const cancelledButPaid = orders.filter(o => o.paidAt && o.status === 'cancelled');
        if (cancelledButPaid.length) {
            console.log(`ℹ ${cancelledButPaid.length} commande(s) payée(s) puis annulée(s) (exclues du CA) :`, cancelledButPaid.map(o => `${o.orderNumber} (${o.total} EUR)`));
        }

        // 2. Obtenir un idToken owner via custom token + Identity Toolkit REST
        const usersSnap = await admin.database().ref('users').once('value');
        const users = usersSnap.val() || {};
        const ownerEntry = Object.entries(users).find(([, u]) => u.email === OWNER_EMAIL && u.role === 'owner');
        if (!ownerEntry) throw new Error(`Owner ${OWNER_EMAIL} introuvable ou role != owner`);
        const [ownerUid] = ownerEntry;

        const customToken = await admin.auth().createCustomToken(ownerUid);
        const signInResp = await postJson(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
            { token: customToken, returnSecureToken: true }
        );
        if (!signInResp.body.idToken) {
            throw new Error('Échec échange custom token -> idToken : ' + JSON.stringify(signInResp.body));
        }
        const idToken = signInResp.body.idToken;

        // 3. Appeler l'API prod réelle
        const statsResp = await getJson(`${PROD_URL}/api/admin/stats`, { Authorization: `Bearer ${idToken}` });
        console.log(`\nRéponse /api/admin/stats (prod) :`, JSON.stringify(statsResp.body.stats));

        const apiRevenue = statsResp.body.stats && statsResp.body.stats.totalRevenue;
        if (apiRevenue === independentTotal) {
            console.log(`\n✅ CA correct : API (${apiRevenue} EUR) == recalcul indépendant (${independentTotal} EUR)`);
        } else {
            console.log(`\n❌ DIVERGENCE : API=${apiRevenue} EUR vs recalcul=${independentTotal} EUR`);
        }
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
