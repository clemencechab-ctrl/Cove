// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Internationalisation FR/EN', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('coveCart');
    });
  });

  test('Page d\'accueil EN - textes en anglais', async ({ page }) => {
    await page.goto('/en/index.html');

    await expect(page).toHaveTitle(/COVE/);
    await expect(page.locator('.hero-title')).toContainText('FIRST COLLECTION');
    await expect(page.locator('.hero-subtitle')).toContainText('Fall / Winter 2026');
  });

  test('Navigation EN - liens corrects', async ({ page }) => {
    await page.goto('/en/index.html');

    await expect(page.locator('.nav-link', { hasText: 'Collection' }).first()).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Contact' })).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Account' })).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Cart' })).toBeVisible();
  });

  test('Page Shop EN', async ({ page }) => {
    await page.goto('/en/shop.html');

    await expect(page).toHaveTitle(/Shop/);
    await expect(page.locator('.shop-title')).toContainText('Shop');
    await expect(page.locator('.shop-card').first()).toBeVisible();
  });

  test('Changement de langue FR -> EN depuis l\'accueil', async ({ page }) => {
    await page.goto('/index.html');

    await page.locator('.language-options a', { hasText: 'EN' }).click();

    await expect(page).toHaveURL(/en\/index\.html/);
    await expect(page.locator('.hero-title')).toContainText('FIRST COLLECTION');
  });

  test('Changement de langue EN -> FR depuis l\'accueil', async ({ page }) => {
    await page.goto('/en/index.html');

    await page.locator('.language-options a', { hasText: 'FR' }).click();

    await expect(page).toHaveURL(/index\.html/);
    await expect(page.locator('.hero-title')).toContainText('PREMIERE COLLECTION');
  });

  test('Panier partage entre les langues', async ({ page }) => {
    // Ajouter un article en FR
    await page.goto('/produit-tshirt.html');
    const sizeL = page.locator('.size-btn', { hasText: /^L$/ });
    await sizeL.click();
    await page.locator('.btn-add-to-cart').click();
    await expect(page.locator('#cart-count').first()).toContainText('1');

    // Aller sur la version EN
    await page.goto('/en/index.html');

    // Le panier doit toujours contenir 1 article
    await expect(page.locator('#cart-count')).toContainText('1');
  });
});
