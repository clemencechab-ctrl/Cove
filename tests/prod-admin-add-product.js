// Test E2E standalone : vérifie que l'ajout d'un produit via l'admin API
// le rend visible dans la section #collection de index.html.
//
// Flow :
//   1. Login owner -> token
//   2. GET /api/products (état initial)
//   3. POST /api/admin/products avec un produit de test unique
//   4. GET /api/products (vérifier qu'il est bien persisté en backend)
//   5. Ouvrir https://covestudio.fr dans un Chromium visible
//   6. Vérifier si le produit apparait dans la section #collection
//   7. Nettoyer : DELETE /api/admin/products/:id
//
// Lancer : node tests/prod-admin-add-product.js

const { chromium } = require('playwright');

const API_BASE = 'https://cove-api-2ywkmeggja-ew.a.run.app';
const FRONT_URL = 'https://covestudio.fr';
const OWNER_EMAIL = 'test-owner@cove-test.com';
const OWNER_PASSWORD = 'CoveOwner2026!';

function log(step, msg) {
    console.log(`\n[${step}] ${msg}`);
}

async function apiPost(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function apiDelete(path, token) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return { status: res.status };
}

(async () => {
    const uniqueName = `Test Collection Item ${Date.now()}`;
    let createdProductId = null;
    let token = null;
    let browser = null;

    try {
        log('1/7', `Login owner ${OWNER_EMAIL}`);
        const login = await apiPost('/api/users/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
        if (login.status !== 200 || !login.data.idToken) {
            throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.data)}`);
        }
        token = login.data.idToken;
        console.log(`      role=${login.data.user.role} uid=${login.data.user.uid}`);
        if (login.data.user.role !== 'owner') {
            throw new Error(`User role is "${login.data.user.role}", expected "owner"`);
        }

        log('2/7', 'GET /api/products (etat initial)');
        const before = await apiGet('/api/products');
        const beforeList = before.data.products || [];
        console.log(`      ${beforeList.length} produit(s) existants : ${beforeList.map(p => p.name).join(', ')}`);

        log('3/7', `POST /api/admin/products { name: "${uniqueName}" }`);
        const create = await apiPost('/api/admin/products', {
            name: uniqueName,
            price: 42,
            category: 'tops',
            description: 'Produit de test temporaire cree par un test E2E.',
            image: 'image/t-shirt-front.JPG',
            sizeStock: { S: 5, M: 5, L: 5, XL: 5 }
        }, token);
        if (create.status !== 200 && create.status !== 201) {
            throw new Error(`Create failed: ${create.status} ${JSON.stringify(create.data)}`);
        }
        createdProductId = create.data.id || create.data.product?.id;
        console.log(`      Produit cree avec id=${createdProductId}`);

        log('4/7', 'GET /api/products (verif backend persistance)');
        const after = await apiGet('/api/products');
        const afterList = after.data.products || [];
        const found = afterList.find(p => p.name === uniqueName);
        console.log(`      ${afterList.length} produit(s) au total`);
        if (!found) throw new Error('Le produit cree est introuvable dans /api/products');
        console.log(`      OK - produit trouve dans l'API (id=${found.id})`);

        log('5/7', `Ouverture de ${FRONT_URL} (navigateur visible)`);
        browser = await chromium.launch({ headless: false, slowMo: 600, args: ['--start-maximized'] });
        const context = await browser.newContext({ viewport: null });
        const page = await context.newPage();
        await page.goto(FRONT_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);

        log('6/7', 'Recherche du produit dans la section #collection');
        // Scroll jusqu'a la section collection
        await page.locator('#collection').scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);

        // 2 checks : (a) nom visible dans le DOM de #collection, (b) data-name attribute
        const domHasProduct = await page.locator('#collection').locator(`text=${uniqueName}`).count();
        const allCardNames = await page.locator('#collection .shop-card [data-name], #collection .shop-card .shop-card-name').allTextContents();
        const dataNames = await page.locator('#collection .shop-card').evaluateAll(cards =>
            cards.map(c => c.getAttribute('data-name'))
        );

        console.log(`      Cartes trouvees dans #collection : ${dataNames.length}`);
        console.log(`      Noms : ${JSON.stringify(dataNames)}`);
        console.log(`      Occurrences textuelles de "${uniqueName}" : ${domHasProduct}`);

        // Screenshot pour l'utilisateur
        await page.screenshot({ path: 'test-results/prod-admin-add-product.png', fullPage: true });
        console.log(`      Screenshot : test-results/prod-admin-add-product.png`);

        const productVisibleOnIndex = domHasProduct > 0 || dataNames.includes(uniqueName);

        await page.waitForTimeout(3000);

        console.log('\n══════════════════════════════════════════════════');
        console.log('  RESULTAT');
        console.log('══════════════════════════════════════════════════');
        console.log(`  [${found ? 'OK' : 'FAIL'}] Produit persiste dans le backend (/api/products)`);
        console.log(`  [${productVisibleOnIndex ? 'OK' : 'FAIL'}] Produit visible dans #collection sur index.html`);

        if (productVisibleOnIndex) {
            console.log('\n  ✅ Le flux admin-add-product fonctionne de bout en bout.');
        } else {
            console.log('\n  ❌ Le flux ne fonctionne PAS : le produit est bien en base mais');
            console.log('     la section #collection de index.html est en HTML statique');
            console.log('     et ne lit pas /api/products.');
            console.log('\n  Fix requis : modifier index.html pour charger dynamiquement les');
            console.log('  produits via fetch(\'/api/products\') au lieu du HTML code en dur.');
        }

    } catch (err) {
        console.error('\n  ERREUR:', err.message);
    } finally {
        if (createdProductId && token) {
            log('7/7', `Nettoyage : DELETE /api/admin/products/${createdProductId}`);
            const del = await apiDelete(`/api/admin/products/${createdProductId}`, token);
            console.log(`      status=${del.status}`);
        }
        if (browser) await browser.close();
    }
})();
