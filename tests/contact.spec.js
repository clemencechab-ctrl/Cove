// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Page Contact', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contact.html');
  });

  test('Formulaire de contact visible avec tous les champs', async ({ page }) => {
    await expect(page).toHaveTitle(/Contact/);

    await expect(page.locator('#contact-form')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#subject')).toBeVisible();
    await expect(page.locator('#message')).toBeVisible();
    await expect(page.locator('.btn-submit')).toBeVisible();
  });

  test('Infos de contact affichees', async ({ page }) => {
    await expect(page.locator('.contact-info')).toBeVisible();
    await expect(page.locator('.contact-info')).toContainText('contact@cove.com');
    await expect(page.locator('.contact-info')).toContainText('Instagram');
  });

  test('Soumission vide bloquee par validation navigateur', async ({ page }) => {
    // Cliquer sur envoyer sans remplir
    await page.locator('.btn-submit').click();

    // Le champ "name" est required, le navigateur bloque la soumission
    // Verifier que le message de succes n'est PAS affiche
    const status = page.locator('#form-status');
    await expect(status).toBeEmpty();
  });

  test('Soumission avec formulaire rempli', async ({ page }) => {
    await page.locator('#name').fill('Jean Test');
    await page.locator('#email').fill('jean@test.com');
    await page.locator('#subject').fill('Question test');
    await page.locator('#message').fill('Ceci est un message de test.');

    await page.locator('.btn-submit').click();

    // Attendre la reponse (succes ou erreur de connexion)
    const status = page.locator('#form-status');
    await expect(status).not.toBeEmpty({ timeout: 10000 });
  });
});
