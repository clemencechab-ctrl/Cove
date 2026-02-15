// @ts-check
const { test, expect } = require('@playwright/test');

const TEST_USER = {
  email: 'test-user@cove-test.com',
  password: 'CoveTest2026!',
};

const TEST_OWNER = {
  email: 'test-owner@cove-test.com',
  password: 'CoveOwner2026!',
};

test.describe('Connexion + Admin', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('coveToken');
      localStorage.removeItem('coveUser');
    });
  });

  test('Page compte - formulaire de connexion visible', async ({ page }) => {
    await page.goto('/compte.html');

    await expect(page).toHaveTitle(/Mon Compte/);
    await expect(page.locator('#auth-section')).toBeVisible();
    await expect(page.locator('#profile-section')).toBeHidden();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('.auth-tab', { hasText: 'Connexion' })).toBeVisible();
    await expect(page.locator('.auth-tab', { hasText: 'Inscription' })).toBeVisible();
  });

  test('Connexion utilisateur', async ({ page }) => {
    await page.goto('/compte.html');

    await page.locator('#login-email').fill(TEST_USER.email);
    await page.locator('#login-password').fill(TEST_USER.password);
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('#profile-section')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#auth-section')).toBeHidden();
    await expect(page.locator('#profile-email')).toContainText(TEST_USER.email);
    await expect(page.locator('#btn-logout')).toBeVisible();
  });

  test('Deconnexion utilisateur', async ({ page }) => {
    await page.goto('/compte.html');
    await page.locator('#login-email').fill(TEST_USER.email);
    await page.locator('#login-password').fill(TEST_USER.password);
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('#profile-section')).toBeVisible({ timeout: 10000 });

    await page.locator('#btn-logout').click();

    await expect(page.locator('#auth-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#profile-section')).toBeHidden();
  });

  test('Erreur de connexion avec mauvais mot de passe', async ({ page }) => {
    await page.goto('/compte.html');

    await page.locator('#login-email').fill(TEST_USER.email);
    await page.locator('#login-password').fill('mauvais_mot_de_passe');
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('#login-error')).not.toBeEmpty({ timeout: 5000 });
    await expect(page.locator('#profile-section')).toBeHidden();
  });

  test('Admin refuse pour un utilisateur normal', async ({ page }) => {
    await page.goto('/compte.html');
    await page.locator('#login-email').fill(TEST_USER.email);
    await page.locator('#login-password').fill(TEST_USER.password);
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('#profile-section')).toBeVisible({ timeout: 10000 });

    await page.goto('/admin.html');

    await expect(page.locator('#access-denied')).toBeVisible({ timeout: 5000 });
  });

  test('Onglet inscription visible', async ({ page }) => {
    await page.goto('/compte.html');

    await page.locator('.auth-tab', { hasText: 'Inscription' }).click();

    await expect(page.locator('#register-form')).toHaveClass(/active/);
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
    await expect(page.locator('#register-confirm')).toBeVisible();
  });
});
