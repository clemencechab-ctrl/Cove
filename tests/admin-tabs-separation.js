// Test E2E visuel : vérifie que l'admin sépare bien Commandes et Clients
// en deux onglets distincts. Démo visible (headed).
// Nécessite : backend local sur http://localhost:3000
// Lancer : node tests/admin-tabs-separation.js

const { chromium } = require('playwright');

const LOCAL = 'http://localhost:3000';
const OWNER_EMAIL = 'test-owner@cove-test.com';
const OWNER_PASSWORD = 'CoveOwner2026!';

function log(step, msg) { console.log(`\n[${step}] ${msg}`); }

(async () => {
    // ── Login via API pour obtenir un token owner ────────────────
    log('1/8', `Login API ${OWNER_EMAIL}`);
    const loginRes = await fetch(`${LOCAL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
    });
    const loginData = await loginRes.json();
    if (!loginData.idToken) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    console.log(`      role=${loginData.user.role} uid=${loginData.user.uid}`);
    if (loginData.user.role !== 'owner') throw new Error(`role=${loginData.user.role} (expected owner)`);

    const browser = await chromium.launch({ headless: false, slowMo: 800, args: ['--start-maximized'] });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    try {
        log('2/8', 'Ouverture de /admin.html');
        await page.goto(`${LOCAL}/admin.html`, { waitUntil: 'domcontentloaded' });

        log('3/8', 'Injection du token owner dans localStorage');
        await page.evaluate(([token, user]) => {
            localStorage.setItem('coveToken', token);
            localStorage.setItem('coveUser', JSON.stringify(user));
        }, [loginData.idToken, loginData.user]);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);

        log('4/8', 'Verification des 6 onglets');
        const tabsText = await page.locator('.admin-tab').allTextContents();
        console.log(`      Onglets : ${JSON.stringify(tabsText)}`);
        const expected = ['Tableau de bord', 'Commandes', 'Clients', 'Produits', 'Codes Promo', 'Messages'];
        const allPresent = expected.every(t => tabsText.includes(t));
        console.log(`      Tous presents : ${allPresent}`);
        if (!allPresent) throw new Error(`Onglets manquants. Trouves: ${tabsText}`);

        log('5/8', 'Onglet Tableau de bord : verifier qu il ne contient QUE des stats');
        const dashboardTab = page.locator('.admin-tab[data-tab="tab-dashboard"]');
        await dashboardTab.click();
        await page.waitForTimeout(1000);
        const dashboardHasNestedOrders = await page.locator('#tab-dashboard .order-row').count();
        const dashboardHasClientCards = await page.locator('#tab-dashboard .client-card').count();
        console.log(`      order-row dans #tab-dashboard : ${dashboardHasNestedOrders}`);
        console.log(`      client-card dans #tab-dashboard : ${dashboardHasClientCards}`);
        if (dashboardHasNestedOrders > 0 || dashboardHasClientCards > 0) {
            throw new Error('Le dashboard contient encore des commandes/clients alors qu ils devraient etre dans leurs propres onglets');
        }

        log('6/8', 'Onglet Commandes : liste plate visible');
        const ordersTab = page.locator('.admin-tab[data-tab="tab-orders"]');
        await ordersTab.click();
        await page.waitForTimeout(1500);
        const ordersTabActive = await page.locator('#tab-orders').evaluate(el => el.classList.contains('active'));
        const orderRowsCount = await page.locator('#tab-orders .order-row').count();
        const nestedInOrders = await page.locator('#tab-orders .client-card').count();
        console.log(`      #tab-orders actif : ${ordersTabActive}`);
        console.log(`      Nombre de .order-row visibles : ${orderRowsCount}`);
        console.log(`      client-card imbriques : ${nestedInOrders} (doit etre 0)`);
        if (nestedInOrders > 0) throw new Error('L onglet Commandes contient des client-cards imbriques');

        // Capture sur ce tab
        await page.screenshot({ path: 'test-results/admin-tab-orders.png', fullPage: true });

        log('7/8', 'Onglet Clients : fiches sans commandes imbriquees');
        const clientsTab = page.locator('.admin-tab[data-tab="tab-clients"]');
        await clientsTab.click();
        await page.waitForTimeout(1500);
        const clientsTabActive = await page.locator('#tab-clients').evaluate(el => el.classList.contains('active'));
        const clientCardsCount = await page.locator('#tab-clients .client-card').count();
        const nestedOrdersInClients = await page.locator('#tab-clients .order-row').count();
        console.log(`      #tab-clients actif : ${clientsTabActive}`);
        console.log(`      Nombre de .client-card visibles : ${clientCardsCount}`);
        console.log(`      order-row imbriques : ${nestedOrdersInClients} (doit etre 0)`);
        if (nestedOrdersInClients > 0) throw new Error('L onglet Clients contient des commandes imbriquees');

        await page.screenshot({ path: 'test-results/admin-tab-clients.png', fullPage: true });

        log('8/8', 'Test du bouton "Voir ses commandes" (si au moins un client)');
        const viewBtns = await page.locator('#tab-clients .btn-admin-action').all();
        console.log(`      Boutons "Voir ses commandes" : ${viewBtns.length}`);
        if (viewBtns.length > 0) {
            await viewBtns[0].click();
            await page.waitForTimeout(1500);
            const nowActive = await page.locator('#tab-orders').evaluate(el => el.classList.contains('active'));
            const searchFilled = await page.locator('#filter-orders-search').inputValue();
            console.log(`      Apres clic : onglet Commandes actif = ${nowActive}, filtre = "${searchFilled}"`);
            if (!nowActive) throw new Error('Le bouton n a pas bascule vers l onglet Commandes');
            if (!searchFilled) throw new Error('Le filtre n a pas ete pre-rempli avec l email');
        } else {
            console.log('      (aucun client avec commandes, test saute)');
        }

        await page.waitForTimeout(3000);

        console.log('\n══════════════════════════════════════════════════');
        console.log('  RESULTAT');
        console.log('══════════════════════════════════════════════════');
        console.log('  [OK] 6 onglets presents incluant Commandes et Clients separes');
        console.log('  [OK] Tableau de bord ne contient plus de commandes/clients');
        console.log('  [OK] Onglet Commandes = liste plate sans cartes client');
        console.log('  [OK] Onglet Clients = fiches sans commandes imbriquees');
        if (viewBtns.length > 0) console.log('  [OK] Bouton "Voir ses commandes" bascule + filtre');
        console.log('\n  ✅ Separation Commandes / Clients validee.');

    } catch (err) {
        console.error('\n  ERREUR:', err.message);
        try { await page.screenshot({ path: 'test-results/admin-tabs-error.png', fullPage: true }); } catch(_) {}
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
