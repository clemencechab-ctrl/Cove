// @ts-check
const { test, expect } = require('@playwright/test');

// Données de test
const CART_ITEM = {
    id: 1,
    name: 'T-shirt Cove',
    price: 30,
    image: 'image/t-shirt-front.JPG',
    size: 'M',
    quantity: 1
};

// Carte de test Stripe (never expires, always succeeds)
const TEST_CARD = {
    number: '4242 4242 4242 4242',
    expiry: '12 / 34',
    cvc: '424',
    name: 'Test Stripe'
};

test.describe('Checkout Stripe - Paiement complet', () => {
    let stripeConfigured = false;

    test.beforeAll(async ({ request }) => {
        const res = await request.get('/api/health');
        const data = await res.json();
        stripeConfigured = data.stripeConfigured === true;
        if (!stripeConfigured) {
            console.warn('\n⚠️  STRIPE_SECRET_KEY non configuré dans backend/.env');
            console.warn('   Ajoutez STRIPE_SECRET_KEY=sk_test_... pour activer ces tests\n');
        }
    });

    test('Paiement complet avec carte de test 4242', async ({ page }) => {
        test.skip(!stripeConfigured, 'STRIPE_SECRET_KEY non configuré dans backend/.env');
        test.setTimeout(120000);

        // ── 1. Préparer le panier ──────────────────────────────────
        await page.goto('/cart.html');
        await page.evaluate((item) => {
            localStorage.setItem('coveCart', JSON.stringify([item]));
        }, CART_ITEM);
        await page.reload();

        await expect(page.locator('.cart-item').first()).toContainText('T-shirt Cove');
        await expect(page.locator('#cart-count')).toContainText('1');

        // ── 2. Ouvrir le formulaire de commande ───────────────────
        await page.locator('#checkout-btn').click();
        await expect(page.locator('#checkout-modal')).toHaveClass(/active/);

        // ── 3. Remplir les informations de livraison ──────────────
        await page.locator('#firstName').fill('Test');
        await page.locator('#lastName').fill('Stripe');
        await page.locator('#email').fill('test-stripe@cove-test.com');
        await page.locator('#phone').fill('0612345678');
        await page.locator('#address').fill('1 Rue du Commerce');
        await page.locator('#city').fill('Paris');
        await page.locator('#postalCode').fill('75008');
        await page.locator('#country').selectOption('FR');

        // ── 4. Soumettre → redirection vers Stripe ────────────────
        await Promise.all([
            page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 }),
            page.locator('.btn-pay').click()
        ]);

        expect(page.url()).toContain('checkout.stripe.com');

        // ── 5. Remplir le formulaire de paiement Stripe ───────────
        // Les champs carte sont directement dans la page checkout.stripe.com
        // (name="cardNumber", "cardExpiry", "cardCvc", "billingName")
        await page.waitForLoadState('load');

        // Attendre que le champ carte soit disponible
        await page.locator('[name="cardNumber"]').waitFor({ timeout: 15000 });

        await page.locator('[name="cardNumber"]').fill(TEST_CARD.number);
        await page.locator('[name="cardExpiry"]').fill(TEST_CARD.expiry);
        await page.locator('[name="cardCvc"]').fill(TEST_CARD.cvc);
        await page.locator('[name="billingName"]').fill(TEST_CARD.name);

        // ── 6. Valider le paiement ─────────────────────────────────
        await page.getByRole('button', { name: /Pay|Payer/i }).click();

        // ── 7. Redirection vers notre page success ─────────────────
        await page.waitForURL(/success\.html\?order=COVE-\d+/, { timeout: 30000 });

        // ── 8. Vérifier la confirmation de paiement ───────────────
        // Le verify endpoint vérifie Stripe API directement (fallback sans webhook CLI)
        await expect(page.locator('#success-section')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#success-section h1')).toContainText('confirmée');

        // Le numéro de commande est affiché
        await expect(page.locator('#order-number-display')).toContainText('COVE-');

        // Le panier est vidé après paiement
        const cartData = await page.evaluate(() => localStorage.getItem('coveCart'));
        expect(cartData === null || cartData === '[]').toBeTruthy();
    });

    test('Annulation de paiement Stripe → section annulation affichée', async ({ page }) => {
        test.skip(!stripeConfigured, 'STRIPE_SECRET_KEY non configuré dans backend/.env');
        test.setTimeout(60000);

        // Simuler directement l'URL d'annulation (cancel_url = /success.html?canceled=true)
        await page.goto('/success.html?canceled=true');

        await expect(page.locator('#cancel-section')).toBeVisible();
        await expect(page.locator('#cancel-section h1')).toContainText('annulé');
        await expect(page.locator('#cancel-section a[href="cart.html"]')).toBeVisible();
    });

    test('Mode démo : paiement sans clé Stripe → succès immédiat', async ({ page }) => {
        test.skip(stripeConfigured, 'Mode démo ignoré quand Stripe est configuré');
        test.setTimeout(30000);

        await page.goto('/cart.html');
        await page.evaluate((item) => {
            localStorage.setItem('coveCart', JSON.stringify([item]));
        }, CART_ITEM);
        await page.reload();

        await page.locator('#checkout-btn').click();
        await page.locator('#firstName').fill('Demo');
        await page.locator('#lastName').fill('User');
        await page.locator('#email').fill('demo@cove-test.com');
        await page.locator('#phone').fill('0612345678');
        await page.locator('#address').fill('1 Rue Demo');
        await page.locator('#city').fill('Paris');
        await page.locator('#postalCode').fill('75001');
        await page.locator('#country').selectOption('FR');

        await Promise.all([
            page.waitForURL(/success\.html/, { timeout: 15000 }),
            page.locator('.btn-pay').click()
        ]);

        await expect(page.locator('#success-section')).toBeVisible({ timeout: 10000 });
    });
});
