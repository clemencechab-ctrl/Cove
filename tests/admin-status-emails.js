// Test E2E : verifie qu'UN email est envoye au client pour CHAQUE changement
// de statut de commande declenche par l'admin.
//
// Backend doit tourner en mode EMAIL demo (EMAIL_HOST='') pour que sendMail
// log "[EMAIL DEMO]" au lieu d'envoyer. Le test lit ce log pour valider.
//
// Statuts testes : confirmed, processing, label_printed, shipped, delivered, cancelled
//
// Lancer : node tests/admin-status-emails.js (backend = port 3000)

const fs = require('fs');

const API = 'http://localhost:3000';
const OWNER_EMAIL = 'test-owner@cove-test.com';
const OWNER_PASSWORD = 'CoveOwner2026!';
const BACKEND_LOG = 'C:\\Users\\cynak\\AppData\\Local\\Temp\\claude\\C--dev-clem-Cove\\8a7a3a19-dddf-44e5-a0e8-4cc61a8ee80f\\tasks\\be69mylw3.output';

// On teste chaque statut + le subject attendu (tel que defini dans email.js)
const STATUSES = [
    { value: 'confirmed',      expectSubject: 'est confirmée' },
    { value: 'processing',     expectSubject: 'est en préparation' },
    { value: 'label_printed',  expectSubject: 'est prête à être expédiée' },
    { value: 'shipped',        expectSubject: 'a ete expédiée' },
    { value: 'delivered',      expectSubject: 'a été livrée' },
    { value: 'cancelled',      expectSubject: 'a été annulée' }
];

function log(step, msg) { console.log(`\n[${step}] ${msg}`); }

async function apiPost(path, body, token) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${API}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function apiPut(path, body, token) {
    const r = await fetch(`${API}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function tailLog() {
    try { return fs.readFileSync(BACKEND_LOG, 'utf8'); } catch(e) { return ''; }
}

(async () => {
    const results = [];
    let orderId = null;
    let orderNumber = null;
    const customerEmail = `test-email-flow-${Date.now()}@cove-test.com`;

    try {
        log('1/5', `Login owner (${OWNER_EMAIL})`);
        const login = await apiPost('/api/users/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
        if (!login.data.idToken) throw new Error(`Login fail: ${JSON.stringify(login.data)}`);
        const token = login.data.idToken;
        console.log(`      OK role=${login.data.user.role}`);

        log('2/5', `Creation d'une commande test (email client: ${customerEmail})`);
        const createOrder = await apiPost('/api/orders', {
            customer: {
                email: customerEmail,
                firstName: 'Client',
                lastName: 'Test',
                phone: '0612345678'
            },
            items: [
                { id: 1, name: 'T-shirt Cove', price: 30, size: 'L', quantity: 1, image: 'image/t-shirt-front.JPG' }
            ],
            shipping: {
                address: '1 Rue du Test',
                city: 'Paris',
                postalCode: '75008',
                country: 'FR'
            }
        }, token);
        if (!createOrder.data.order) throw new Error(`Creation fail: ${JSON.stringify(createOrder.data)}`);
        orderId = createOrder.data.order.id;
        orderNumber = createOrder.data.order.orderNumber;
        console.log(`      OK order id=${orderId} number=${orderNumber}`);

        log('3/5', `Position de reference dans les logs backend (mark)`);
        const logMark = tailLog().length;
        console.log(`      mark = ${logMark} bytes`);

        log('4/5', `Declenchement de chaque statut et verification des emails`);
        for (const s of STATUSES) {
            process.stdout.write(`   -> ${s.value.padEnd(15)} `);
            const upd = await apiPut(`/api/admin/orders/${orderId}/status`, { status: s.value }, token);
            if (upd.status !== 200) {
                console.log(`HTTP ${upd.status} FAIL`);
                results.push({ status: s.value, ok: false, reason: `HTTP ${upd.status}` });
                continue;
            }
            // Laisser le temps a sendMail de logger
            await sleep(300);
            const newLog = tailLog().slice(logMark);
            const demoLineSubject = newLog.split('\n').find(l => l.includes('[EMAIL DEMO] Subject:') && l.toLowerCase().includes(s.expectSubject.toLowerCase().substring(0, 15)));
            const demoLineTo = newLog.split('\n').find(l => l.includes('[EMAIL DEMO] To:') && l.includes(customerEmail));
            const confirmLine = newLog.split('\n').find(l => l.includes(`Email statut "${s.value}" envoyé pour commande ${orderNumber}`));

            if (demoLineTo && (demoLineSubject || confirmLine)) {
                console.log('OK');
                results.push({ status: s.value, ok: true });
            } else {
                console.log('FAIL (aucune trace d email)');
                results.push({ status: s.value, ok: false, reason: 'pas de log email trouve' });
            }
        }

        log('5/5', 'Synthese');
        console.log('\n══════════════════════════════════════════════════');
        console.log('  RESULTATS : 1 email par changement de statut');
        console.log('══════════════════════════════════════════════════');
        let passed = 0;
        for (const r of results) {
            console.log(`  [${r.ok ? 'OK  ' : 'FAIL'}] ${r.status.padEnd(15)} ${r.ok ? '' : '- ' + r.reason}`);
            if (r.ok) passed++;
        }
        console.log(`\n  ${passed}/${STATUSES.length} statuts declenchent un email`);

        if (passed === STATUSES.length) {
            console.log('\n  ✅ SUCCES : tous les changements de statut envoient un email au client.');
            process.exit(0);
        } else {
            console.log('\n  ❌ ECHEC : certains statuts ne declenchent pas d email.');
            process.exit(1);
        }

    } catch (err) {
        console.error('\n  ERREUR:', err.message);
        process.exit(1);
    }
})();
