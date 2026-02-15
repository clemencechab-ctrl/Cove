// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Pages legales et informatives', () => {

  test('Page CGV accessible et contenu present', async ({ page }) => {
    await page.goto('/cgv.html');

    await expect(page).toHaveTitle(/Conditions Generales/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.footer')).toBeVisible();
    // Verifier qu'il y a du contenu textuel
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text.length).toBeGreaterThan(200);
  });

  test('Page Mentions legales accessible et contenu present', async ({ page }) => {
    await page.goto('/mentions-legales.html');

    await expect(page).toHaveTitle(/Mentions Legales/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.footer')).toBeVisible();
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text.length).toBeGreaterThan(200);
  });

  test('Page Confidentialite accessible et contenu present', async ({ page }) => {
    await page.goto('/confidentialite.html');

    await expect(page).toHaveTitle(/Confidentialite/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.footer')).toBeVisible();
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text.length).toBeGreaterThan(200);
  });

  test('Page Retours accessible et contenu present', async ({ page }) => {
    await page.goto('/retours.html');

    await expect(page).toHaveTitle(/Retour/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.footer')).toBeVisible();
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text.length).toBeGreaterThan(200);
  });

  test('Page About accessible et contenu present', async ({ page }) => {
    await page.goto('/about.html');

    await expect(page).toHaveTitle(/Notre Histoire/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.footer')).toBeVisible();
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text.length).toBeGreaterThan(100);
  });

  test('Navigation depuis le footer vers les pages legales', async ({ page }) => {
    await page.goto('/index.html');

    // Cliquer sur CGV dans le footer
    await page.locator('.footer a[href="cgv.html"]').click();
    await expect(page).toHaveURL(/cgv\.html/);
    await expect(page).toHaveTitle(/Conditions Generales/);
  });

  test('Navigation retour depuis une page legale', async ({ page }) => {
    await page.goto('/cgv.html');

    // Cliquer sur le logo pour retourner a l'accueil
    await page.locator('.logo a').click();
    await expect(page).toHaveURL(/index\.html|\/$/);
  });
});
