// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Mot de passe oublie', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('coveToken');
      localStorage.removeItem('coveUser');
    });
  });

  test('Lien "Mot de passe oublie" visible sur la page connexion', async ({ page }) => {
    await page.goto('/compte.html');

    await expect(page.locator('#forgot-password-link')).toBeVisible();
    await expect(page.locator('#forgot-password-link')).toContainText('Mot de passe oublie');
  });

  test('Clic sur "Mot de passe oublie" affiche le formulaire', async ({ page }) => {
    await page.goto('/compte.html');

    await page.locator('#forgot-password-link').click();

    await expect(page.locator('#forgot-password-form')).toHaveClass(/active/);
    await expect(page.locator('#login-form')).not.toHaveClass(/active/);
    await expect(page.locator('#forgot-email')).toBeVisible();
    await expect(page.locator('#forgot-password-form button[type="submit"]')).toBeVisible();
  });

  test('Retour a la connexion depuis le formulaire mot de passe oublie', async ({ page }) => {
    await page.goto('/compte.html');

    await page.locator('#forgot-password-link').click();
    await expect(page.locator('#forgot-password-form')).toHaveClass(/active/);

    await page.locator('#back-to-login').click();

    await expect(page.locator('#login-form')).toHaveClass(/active/);
    await expect(page.locator('#forgot-password-form')).not.toHaveClass(/active/);
  });

  test('Soumission avec un email envoie la requete', async ({ page }) => {
    await page.goto('/compte.html');

    await page.locator('#forgot-password-link').click();
    await expect(page.locator('#forgot-password-form')).toHaveClass(/active/);

    await page.locator('#forgot-email').fill('test-user@cove-test.com');
    await page.locator('#forgot-password-form button[type="submit"]').click();

    await expect(page.locator('#forgot-success')).not.toBeEmpty({ timeout: 5000 });
    await expect(page.locator('#forgot-error')).toBeEmpty();
  });
});
