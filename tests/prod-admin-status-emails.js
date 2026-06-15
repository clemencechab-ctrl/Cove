// Test E2E sur PROD : verifie que chaque changement de statut declenche
// un email au client, en lisant les logs Cloud Run via gcloud.
//
// Lancer : node tests/prod-admin-status-emails.js

const { execSync, spawnSync } = require('child_process');

const API = 'https://cove-api-2ywkmeggja-ew.a.run.app';
const OWNER_EMAIL = 'clemence.chab@gmail.com';
const OWNER_PASSWORD = 'CoveAdmin2026!';
const GCLOUD = 'C:\\Users\\cynak\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';

const STATUSES = [
    { value: 'confirmed',     subjectFragment: 'confirmée' },
    { value: 'processing',    subjectFragment: 'préparation' },
    { value: 'label_printed', subjectFragment: 'expédiée' }, // "prete a etre expediee"
    { value: 'shipped',       subjectFragment: 'expédiée' },
    { value: 'delivered',     subjectFragment: 'livrée' },
    { value: 'cancelled',     subjectFragment: 'annulée' }
];

function log(s, m) { console.log(`\n[${s}] ${m}`); }

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

function fetchCloudRunLogs() {
    // spawnSync avec args array : pas de probleme de quoting shell.
    // shell:true necessaire pour que les .cmd Windows s'executent correctement depuis Node
    const result = spawnSync(`"${GCLOUD}"`, [
        'logging', 'read',
        '"resource.type=cloud_run_revision AND resource.labels.service_name=cove-api"',
        '--project=covestudio',
        '--limit=500',
        '--format="value(textPayload)"',
        '--freshness=10m'
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: true });
    if (result.status !== 0) {
        console.error('      gcloud stderr:', (result.stderr || '').substring(0, 300));
    }
    return result.stdout || '';
}

(async () => {
    const results = [];
    let orderId, orderNumber;
    const customerEmail = `test-prod-email-${Date.now()}@cove-test.com`;
    const startTs = new Date(Date.now() - 60000).toISOString();

    try {
        log('1/5', `Login owner ${OWNER_EMAIL} sur prod`);
        const lg = await apiPost('/api/users/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
        if (!lg.data.idToken) throw new Error(JSON.stringify(lg.data));
        const token = lg.data.idToken;
        console.log(`      OK role=${lg.data.user.role}`);

        log('2/5', `Creation commande test (client: ${customerEmail})`);
        const co = await apiPost('/api/orders', {
            customer: { email: customerEmail, firstName: 'Prod', lastName: 'Test', phone: '0612345678' },
            items: [{ id: 1, name: 'T-shirt Cove', price: 30, size: 'XL', quantity: 1, image: 'image/t-shirt-front.JPG' }],
            shipping: { address: '1 Rue Test', city: 'Paris', postalCode: '75008', country: 'FR' }
        }, token);
        if (!co.data.order) throw new Error(`Creation fail: ${JSON.stringify(co.data)}`);
        orderId = co.data.order.id;
        orderNumber = co.data.order.orderNumber;
        console.log(`      OK id=${orderId} number=${orderNumber}`);

        log('3/5', 'Declenchement des 6 transitions de statut (PUT /api/admin/orders/:id/status)');
        for (const s of STATUSES) {
            process.stdout.write(`   -> ${s.value.padEnd(15)} `);
            const up = await apiPut(`/api/admin/orders/${orderId}/status`, { status: s.value }, token);
            if (up.status !== 200) {
                console.log(`HTTP ${up.status} FAIL`);
                results.push({ status: s.value, api: false });
            } else {
                console.log('API OK');
                results.push({ status: s.value, api: true });
            }
            await sleep(500); // laisser l email partir
        }

        log('4/5', 'Attente 10s pour que les logs Cloud Run remontent...');
        await sleep(10000);

        log('5/5', 'Lecture des logs Cloud Run et matching');
        const logs = fetchCloudRunLogs();
        console.log(`      ${logs.split('\n').length} lignes de logs recuperees`);

        for (const r of results) {
            // Encodage Windows cp1252 mange le "é" en "?". On match donc avec un regex tolerant.
            const re = new RegExp(`Email statut "${r.status}" envoy[é?] pour commande ${orderNumber.replace(/-/g, '\\-')}`);
            r.emailLogged = re.test(logs);
        }

        console.log('\n══════════════════════════════════════════════════');
        console.log(`  RESULTATS EN PROD (commande ${orderNumber})`);
        console.log('══════════════════════════════════════════════════');
        let ok = 0;
        for (const r of results) {
            const mark = r.api && r.emailLogged ? 'OK  ' : 'FAIL';
            console.log(`  [${mark}] ${r.status.padEnd(15)}  API: ${r.api ? 'OK' : 'FAIL'}  email log: ${r.emailLogged ? 'OK' : 'MANQUANT'}`);
            if (r.api && r.emailLogged) ok++;
        }
        console.log(`\n  ${ok}/${STATUSES.length} statuts -> email confirme via logs Cloud Run`);

        if (ok === STATUSES.length) {
            console.log('\n  ✅ SUCCES : chaque changement de statut envoie un email au client en PROD.');
            process.exit(0);
        } else {
            console.log('\n  ⚠️  Pas tous les emails detectes. Verifie les logs brut :');
            console.log(logs.substring(0, 2000));
            process.exit(1);
        }

    } catch (err) {
        console.error('\n  ERREUR:', err.message);
        process.exit(1);
    }
})();
