// Test E2E visuel sur PRODUCTION : verifie que covestudio.fr/admin.html
// affiche bien les onglets Commandes et Clients separes.
// Lancer : node tests/prod-admin-tabs-separation.js

const { chromium } = require('playwright');

const PROD = 'https://covestudio.fr';
const API = 'https://cove-api-2ywkmeggja-ew.a.run.app';
const OWNER_EMAIL = 'clemence.chab@gmail.com';
const OWNER_PASSWORD = 'CoveAdmin2026!';

function log(step, msg) { console.log(`\n[${step}] ${msg}`); }

(async () => {
    log('1/9', `Login API ${OWNER_EMAIL} sur ${API}`);
    const loginRes = await fetch(`${API}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
    });
    const loginData = await loginRes.json();
    if (!loginData.idToken) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    console.log(`      OK role=${loginData.user.role} uid=${loginData.user.uid}`);
    if (loginData.user.role !== 'owner') throw new Error(`role=${loginData.user.role}, expected owner`);

    const browser = await chromium.launch({ headless: false, slowMo: 900, args: ['--start-maximized'] });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    try {
        log('2/9', `Ouverture de ${PROD}/admin.html`);
        await page.goto(`${PROD}/admin.html`, { waitUntil: 'domcontentloaded' });

        log('3/9', 'Injection du token owner dans localStorage');
        await page.evaluate(([token, user]) => {
            localStorage.setItem('coveToken', token);
            localStorage.setItem('coveUser', JSON.stringify(user));
        }, [loginData.idToken, loginData.user]);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        log('4/9', 'Verification des 6 onglets sur PROD');
        const tabsText = await page.locator('.admin-tab').allTextContents();
        console.log(`      Onglets trouves : ${JSON.stringify(tabsText)}`);
        const expected = ['Tableau de bord', 'Commandes', 'Clients', 'Produits', 'Codes Promo', 'Messages'];
        const allPresent = expected.every(t => tabsText.includes(t));
        if (!allPresent) throw new Error(`Onglets manquants. Attendu: ${expected} Trouve: ${tabsText}`);
        console.log('      OK - 6 onglets presents');

        log('5/9', 'Clic onglet Tableau de bord : stats uniquement');
        await page.locator('.admin-tab[data-tab="tab-dashboard"]').click();
        await page.waitForTimeout(1000);
        const dashOrders = await page.locator('#tab-dashboard .order-row').count();
        const dashClients = await page.locator('#tab-dashboard .client-card').count();
        console.log(`      order-row: ${dashOrders}, client-card: ${dashClients} (les deux doivent etre 0)`);
        if (dashOrders > 0 || dashClients > 0) throw new Error('Dashboard contient encore commandes/clients imbriques');

        log('6/9', 'Clic onglet Commandes : liste plate');
        await page.locator('.admin-tab[data-tab="tab-orders"]').click();
        await page.waitForTimeout(2000);
        const ordersCount = await page.locator('#tab-orders .order-row').count();
        const nestedClients = await page.locator('#tab-orders .client-card').count();
        console.log(`      .order-row dans Commandes : ${ordersCount}`);
        console.log(`      .client-card imbriquees : ${nestedClients} (doit etre 0)`);
        if (nestedClients > 0) throw new Error('Onglet Commandes contient des cartes client');
        await page.screenshot({ path: 'test-results/prod-admin-tab-orders.png', fullPage: true });

        log('7/9', 'Clic onglet Clients : fiches sans commandes imbriquees');
        await page.locator('.admin-tab[data-tab="tab-clients"]').click();
        await page.waitForTimeout(2000);
        const clientsCount = await page.locator('#tab-clients .client-card').count();
        const nestedOrders = await page.locator('#tab-clients .order-row').count();
        console.log(`      .client-card dans Clients : ${clientsCount}`);
        console.log(`      .order-row imbriquees : ${nestedOrders} (doit etre 0)`);
        if (nestedOrders > 0) throw new Error('Onglet Clients contient des commandes imbriquees');
        await page.screenshot({ path: 'test-results/prod-admin-tab-clients.png', fullPage: true });

        log('8/9', 'Test bouton "Voir ses commandes"');
        const viewBtns = await page.locator('#tab-clients .btn-admin-action').all();
        console.log(`      Boutons : ${viewBtns.length}`);
        if (viewBtns.length > 0) {
            await viewBtns[0].click();
            await page.waitForTimeout(1500);
            const ordersActive = await page.locator('#tab-orders').evaluate(el => el.classList.contains('active'));
            const searchVal = await page.locator('#filter-orders-search').inputValue();
            console.log(`      Apres clic - Commandes actif: ${ordersActive}, filtre: "${searchVal}"`);
            if (!ordersActive) throw new Error('Bascule vers Commandes echouee');
            if (!searchVal) throw new Error('Filtre email non pre-rempli');
        }

        log('9/9', 'Verification finale : URL du navigateur');
        console.log(`      URL : ${page.url()}`);
        if (!page.url().startsWith('https://covestudio.fr/')) throw new Error('Pas sur covestudio.fr');

        await page.waitForTimeout(4000);

        console.log('\n══════════════════════════════════════════════════');
        console.log('  ✅ TEST E2E PROD VALIDE');
        console.log('══════════════════════════════════════════════════');
        console.log('  [OK] 6 onglets sur covestudio.fr/admin.html');
        console.log('  [OK] Tableau de bord = stats uniquement');
        console.log('  [OK] Onglet Commandes = liste plate');
        console.log('  [OK] Onglet Clients = fiches sans commandes imbriquees');
        if (viewBtns.length > 0) console.log('  [OK] "Voir ses commandes" bascule + filtre');
        console.log(`\n  Captures : test-results/prod-admin-tab-*.png`);

    } catch (err) {
        console.error('\n  ERREUR:', err.message);
        try { await page.screenshot({ path: 'test-results/prod-admin-error.png', fullPage: true }); } catch(_) {}
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
