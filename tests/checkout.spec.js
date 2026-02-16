// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Checkout / Paiement', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/cart.html');
    await page.evaluate(() => {
      const cart = [{
        id: 1,
        name: 'T-shirt Cove',
        price: 30,
        image: 'image/t-shirt-front.JPG',
        size: 'M',
        quantity: 1
      }];
      localStorage.setItem('coveCart', JSON.stringify(cart));
    });
    await page.reload();
  });

  test('Panier affiche correctement avant checkout', async ({ page }) => {
    await expect(page.locator('.cart-item').first()).toContainText('T-shirt Cove');
    await expect(page.locator('#total')).toContainText('35.90');
    await expect(page.locator('#checkout-btn')).toBeVisible();
    await expect(page.locator('#checkout-btn')).toBeEnabled();
  });

  test('Ouvrir le formulaire de commande', async ({ page }) => {
    await page.locator('#checkout-btn').click();

    await expect(page.locator('#checkout-modal')).toHaveClass(/active/);

    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#lastName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('#postalCode')).toBeVisible();
    await expect(page.locator('#country')).toBeVisible();

    await expect(page.locator('#checkout-subtotal')).toContainText('30');
  });

  test('Fermer la modale de checkout', async ({ page }) => {
    await page.locator('#checkout-btn').click();
    await expect(page.locator('#checkout-modal')).toHaveClass(/active/);

    await page.locator('.checkout-close').click();

    await expect(page.locator('#checkout-modal')).not.toHaveClass(/active/);
    await expect(page.locator('.cart-item').first()).toContainText('T-shirt Cove');
  });

  test('Remplir le formulaire de commande', async ({ page }) => {
    await page.locator('#checkout-btn').click();
    await expect(page.locator('#checkout-modal')).toHaveClass(/active/);

    await page.locator('#firstName').fill('Jean');
    await page.locator('#lastName').fill('Dupont');
    await page.locator('#email').fill('jean.dupont@test.com');
    await page.locator('#phone').fill('0612345678');
    await page.locator('#address').fill('12 Rue de la Paix');
    await page.locator('#city').fill('Paris');
    await page.locator('#postalCode').fill('75001');
    await page.locator('#country').selectOption('FR');

    // Verifier que les champs sont remplis
    await expect(page.locator('#firstName')).toHaveValue('Jean');
    await expect(page.locator('#lastName')).toHaveValue('Dupont');
    await expect(page.locator('#email')).toHaveValue('jean.dupont@test.com');

    // Verifier que le bouton payer est present
    await expect(page.locator('.btn-pay')).toBeVisible();
  });
});
