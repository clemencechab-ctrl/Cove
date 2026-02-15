// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Responsive / Mobile', () => {

  test.use({ viewport: { width: 375, height: 812 } }); // iPhone viewport

  test('Page d\'accueil responsive', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/COVE/);
    await expect(page.locator('.hero-title')).toBeVisible();

    // Verifier que les produits s'affichent
    await expect(page.locator('.shop-card').first()).toBeVisible();
  });

  test('Page produit responsive - galerie et tailles', async ({ page }) => {
    await page.goto('/produit-tshirt.html');

    await expect(page.locator('.product-title')).toContainText('T-shirt Cove');
    await expect(page.locator('#main-image')).toBeVisible();

    // Verifier les boutons de taille
    const sizeButtons = page.locator('.size-btn');
    await expect(sizeButtons).toHaveCount(4);
    await expect(sizeButtons.first()).toBeVisible();

    // Verifier le bouton ajouter au panier
    await expect(page.locator('.btn-add-to-cart')).toBeVisible();
  });

  test('Panier responsive', async ({ page }) => {
    await page.goto('/cart.html');
    await page.evaluate(() => {
      const cart = [{
        id: 1,
        name: 'T-shirt Cove',
        price: 65,
        image: 'image/t-shirt-front.JPG',
        size: 'M',
        quantity: 1
      }];
      localStorage.setItem('coveCart', JSON.stringify(cart));
    });
    await page.reload();

    await expect(page.locator('.cart-item').first()).toBeVisible();
    await expect(page.locator('.cart-item').first()).toContainText('T-shirt Cove');
    await expect(page.locator('#total')).toContainText('65');
    await expect(page.locator('#checkout-btn')).toBeVisible();
  });

  test('Page shop responsive', async ({ page }) => {
    await page.goto('/shop.html');

    // Verifier que les produits s'affichent
    await expect(page.locator('.shop-card').first()).toBeVisible();

    // Verifier la barre de recherche
    await expect(page.locator('#shop-search')).toBeVisible();

    // Verifier les filtres
    await expect(page.locator('.filter-btn').first()).toBeVisible();
  });

  test('Footer visible sur mobile', async ({ page }) => {
    await page.goto('/');

    // Scroller en bas
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(page.locator('.footer')).toBeVisible();
    await expect(page.locator('.footer-bottom')).toBeVisible();
  });
});
