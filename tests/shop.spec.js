// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Page Shop', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/shop.html');
    await page.evaluate(() => {
      localStorage.removeItem('coveCart');
    });
  });

  test('Affichage de tous les produits', async ({ page }) => {
    const cards = page.locator('.shop-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Filtre par categorie Tops', async ({ page }) => {
    await page.locator('.filter-btn', { hasText: 'Tops' }).click();

    const visibleCards = page.locator('.shop-card:visible');
    const allCards = page.locator('.shop-card');
    const totalCount = await allCards.count();

    for (let i = 0; i < totalCount; i++) {
      const card = allCards.nth(i);
      const category = await card.getAttribute('data-category');
      const isVisible = await card.isVisible();
      if (category === 'tops') {
        expect(isVisible).toBe(true);
      } else {
        expect(isVisible).toBe(false);
      }
    }
  });

  test('Filtre "Tout" affiche tous les produits', async ({ page }) => {
    // Filtrer d'abord par Tops
    await page.locator('.filter-btn', { hasText: 'Tops' }).click();

    // Puis revenir a Tout
    await page.locator('.filter-btn', { hasText: 'Tout' }).click();

    const allCards = page.locator('.shop-card');
    const totalCount = await allCards.count();
    for (let i = 0; i < totalCount; i++) {
      await expect(allCards.nth(i)).toBeVisible();
    }
  });

  test('Recherche produit par nom', async ({ page }) => {
    await page.locator('#shop-search').fill('hoodie');

    // Le hoodie doit etre visible
    const hoodieCard = page.locator('.shop-card', { hasText: 'Hoodie' });
    await expect(hoodieCard).toBeVisible();

    // Les autres produits doivent etre caches
    const allCards = page.locator('.shop-card');
    const totalCount = await allCards.count();
    for (let i = 0; i < totalCount; i++) {
      const card = allCards.nth(i);
      const name = await card.getAttribute('data-name');
      if (!name.toLowerCase().includes('hoodie')) {
        await expect(card).toBeHidden();
      }
    }
  });

  test('Tri par prix croissant', async ({ page }) => {
    await page.locator('#shop-sort').selectOption('price-asc');

    const cards = page.locator('.shop-card:visible');
    const count = await cards.count();
    const prices = [];
    for (let i = 0; i < count; i++) {
      const price = await cards.nth(i).getAttribute('data-price');
      prices.push(parseFloat(price));
    }

    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  test('Tri par prix decroissant', async ({ page }) => {
    await page.locator('#shop-sort').selectOption('price-desc');

    const cards = page.locator('.shop-card:visible');
    const count = await cards.count();
    const prices = [];
    for (let i = 0; i < count; i++) {
      const price = await cards.nth(i).getAttribute('data-price');
      prices.push(parseFloat(price));
    }

    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  test('Tri par nom A-Z', async ({ page }) => {
    await page.locator('#shop-sort').selectOption('name-az');

    const cards = page.locator('.shop-card:visible');
    const count = await cards.count();
    const names = [];
    for (let i = 0; i < count; i++) {
      const name = await cards.nth(i).getAttribute('data-name');
      names.push(name);
    }

    for (let i = 1; i < names.length; i++) {
      expect(names[i].localeCompare(names[i - 1])).toBeGreaterThanOrEqual(0);
    }
  });

  test('Ajout rapide au panier avec taille selectionnee', async ({ page }) => {
    const firstCard = page.locator('.shop-card').first();

    // Hover pour faire apparaitre l'overlay
    await firstCard.hover();

    // Selectionner une taille
    const sizeBtn = firstCard.locator('.shop-size-btn', { hasText: 'M' });
    await sizeBtn.click();
    await expect(sizeBtn).toHaveClass(/active/);

    // Ajouter au panier
    await firstCard.locator('.btn-add-cart').click();

    // Verifier le compteur
    await expect(page.locator('#cart-count')).toContainText('1');
  });

  test('Ajout sans taille affiche un message', async ({ page }) => {
    const firstCard = page.locator('.shop-card').first();

    // Hover pour faire apparaitre l'overlay
    await firstCard.hover();

    // Cliquer sur ajouter sans selectionner de taille
    await firstCard.locator('.btn-add-cart').click();

    // Le compteur du panier doit rester a 0
    await expect(page.locator('#cart-count')).toContainText('0');
  });
});
