// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation + Panier', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('coveCart');
    });
  });

  test('Page d\'accueil - titre et navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/COVE/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.logo')).toBeVisible();

    await expect(page.locator('.nav-link', { hasText: 'Collection' }).first()).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Contact' })).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Compte' })).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Panier' })).toBeVisible();

    await expect(page.locator('.hero-title')).toContainText('PREMIERE COLLECTION');
    await expect(page.locator('#collection')).toBeVisible();
    await expect(page.locator('.shop-card').first()).toBeVisible();
  });

  test('Navigation vers la page produit T-shirt', async ({ page }) => {
    await page.goto('/');

    await page.locator('.shop-card-link').first().click();

    await expect(page).toHaveTitle(/T-shirt Cove/);
    await expect(page.locator('.product-title')).toContainText('T-shirt Cove');
    await expect(page.locator('.product-price')).toContainText('30 EUR');

    await expect(page.locator('.size-btn').first()).toBeVisible();
    const sizeButtons = page.locator('.size-btn');
    await expect(sizeButtons).toHaveCount(4);

    await expect(page.locator('.btn-add-to-cart')).toBeVisible();
  });

  test('Selectionner une taille et ajouter au panier', async ({ page }) => {
    await page.goto('/produit-tshirt.html');

    // Selectionner la taille L (active par defaut mais on clique pour etre sur)
    const sizeL = page.locator('.size-btn', { hasText: /^L$/ });
    await sizeL.click();
    await expect(sizeL).toHaveClass(/active/);

    await page.locator('.btn-add-to-cart').click();

    await expect(page.locator('#cart-count').first()).toContainText('1');
  });

  test('Verifier le panier avec un article', async ({ page }) => {
    await page.goto('/cart.html');
    await page.evaluate(() => {
      const cart = [{
        id: 1,
        name: 'T-shirt Cove',
        price: 30,
        image: 'image/t-shirt-front.JPG',
        size: 'L',
        quantity: 1
      }];
      localStorage.setItem('coveCart', JSON.stringify(cart));
    });
    await page.reload();

    await expect(page.locator('#cart-items')).toBeVisible();
    await expect(page.locator('.cart-item').first()).toBeVisible();
    await expect(page.locator('.cart-item').first()).toContainText('T-shirt Cove');
    await expect(page.locator('.cart-item').first()).toContainText('Taille L');
    await expect(page.locator('#total')).toContainText('30');
    await expect(page.locator('#checkout-btn')).toBeVisible();
  });

  test('Parcours complet: accueil > produit > panier', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/COVE/);

    // Cliquer sur le T-shirt
    await page.locator('.shop-card-link').first().click();
    await expect(page.locator('.product-title')).toContainText('T-shirt Cove');

    // Selectionner taille L
    const sizeL = page.locator('.size-btn', { hasText: /^L$/ });
    await sizeL.click();
    await expect(sizeL).toHaveClass(/active/);

    // Ajouter au panier
    await page.locator('.btn-add-to-cart').click();
    await expect(page.locator('#cart-count').first()).toContainText('1');

    // Aller au panier
    await page.locator('a[href="cart.html"]').click();
    await expect(page).toHaveURL(/cart\.html/);

    await expect(page.locator('#cart-items')).toBeVisible();
    await expect(page.locator('.cart-item').first()).toContainText('T-shirt Cove');
    await expect(page.locator('#total')).toContainText('30');
  });
});
