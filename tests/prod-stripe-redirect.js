// Test E2E standalone : vérifie qu'un paiement Stripe sur https://covestudio.fr
// redirige bien vers covestudio.fr/success.html (et PAS vers localhost).
// Lancer avec : node tests/prod-stripe-redirect.js

const { chromium } = require('playwright');

const PROD_URL = 'https://covestudio.fr';
const CART_ITEM = {
    id: 1,
    name: 'T-shirt Cove',
    price: 30,
    image: 'image/t-shirt-front.JPG',
    size: 'M',
    quantity: 1
};
const TEST_CARD = {
    number: '4242 4242 4242 4242',
    expiry: '12 / 34',
    cvc: '424',
    name: 'Test Stripe Fix'
};

function log(step, msg) {
    console.log(`\n[${step}] ${msg}`);
}

(async () => {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 800,
        args: ['--start-maximized']
    });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    try {
        log('1/8', `Ouverture de ${PROD_URL}/cart.html`);
        await page.goto(`${PROD_URL}/cart.html`, { waitUntil: 'domcontentloaded' });

        log('2/8', 'Injection du panier (T-shirt taille M)');
        await page.evaluate((item) => {
            localStorage.setItem('coveCart', JSON.stringify([item]));
        }, CART_ITEM);
        await page.reload();
        await page.waitForSelector('.cart-item', { timeout: 15000 });

        log('3/8', 'Ouverture du formulaire de commande');
        await page.locator('#checkout-btn').click();
        await page.waitForSelector('#checkout-modal.active', { timeout: 10000 });

        log('4/8', 'Remplissage des informations de livraison');
        await page.locator('#firstName').fill('Test');
        await page.locator('#lastName').fill('RedirectFix');
        await page.locator('#email').fill('test-redirect-fix@cove-test.com');
        await page.locator('#phone').fill('0612345678');
        await page.locator('#address').fill('1 Rue du Test');
        await page.locator('#city').fill('Paris');
        await page.locator('#postalCode').fill('75008');
        await page.locator('#country').selectOption('FR');

        log('5/8', 'Soumission → redirection vers Stripe Checkout');
        await Promise.all([
            page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 }),
            page.locator('.btn-pay').click()
        ]);
        console.log('      URL Stripe:', page.url());

        log('6/8', 'Remplissage du formulaire de paiement Stripe');
        await page.waitForLoadState('load');
        await page.locator('[name="cardNumber"]').waitFor({ timeout: 20000 });
        await page.locator('[name="cardNumber"]').fill(TEST_CARD.number);
        await page.locator('[name="cardExpiry"]').fill(TEST_CARD.expiry);
        await page.locator('[name="cardCvc"]').fill(TEST_CARD.cvc);
        await page.locator('[name="billingName"]').fill(TEST_CARD.name);

        log('7/8', 'Validation du paiement (bouton Pay)');
        await page.getByRole('button', { name: /Pay|Payer/i }).click();

        log('8/8', 'Attente de la redirection post-paiement...');
        await page.waitForURL(/success\.html/, { timeout: 60000 });

        const finalUrl = page.url();
        console.log('\n      URL finale:', finalUrl);

        // ─── ASSERTIONS CRITIQUES ──────────────────────────────────
        console.log('\n══════════════════════════════════════════════════');
        console.log('  RESULTATS DU TEST');
        console.log('══════════════════════════════════════════════════');

        const isOnProdDomain = finalUrl.startsWith('https://covestudio.fr/');
        const isNotLocalhost = !finalUrl.includes('localhost');
        const hasSuccessPath = finalUrl.includes('/success.html');
        const hasOrderParam = /order=COVE-\d+/.test(finalUrl);

        console.log(`  [${isOnProdDomain ? 'OK' : 'FAIL'}] URL commence par https://covestudio.fr/`);
        console.log(`  [${isNotLocalhost ? 'OK' : 'FAIL'}] URL ne contient PAS "localhost"`);
        console.log(`  [${hasSuccessPath ? 'OK' : 'FAIL'}] URL pointe sur /success.html`);
        console.log(`  [${hasOrderParam ? 'OK' : 'FAIL'}] URL contient un numero de commande COVE-xxxxx`);

        await page.waitForTimeout(5000);

        if (isOnProdDomain && isNotLocalhost && hasSuccessPath && hasOrderParam) {
            console.log('\n  ✅ FIX VALIDE : la redirection Stripe revient bien sur covestudio.fr');
            process.exit(0);
        } else {
            console.log('\n  ❌ FIX NON VALIDE');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n  ERREUR:', err.message);
        await page.screenshot({ path: 'test-results/prod-stripe-redirect-error.png', fullPage: true }).catch(() => {});
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
