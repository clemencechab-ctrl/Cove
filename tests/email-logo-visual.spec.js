// @ts-check
// Test visuel : rend le HTML exact envoye dans les emails en mode clair et sombre
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function buildEmailHtml() {
    const darkLogo = fs.readFileSync(path.join(__dirname, '..', 'image', 'logo-cove.png'));
    const whiteLogo = fs.readFileSync(path.join(__dirname, '..', 'image', 'logo-cove-white.png'));
    const darkDataUrl = 'data:image/png;base64,' + darkLogo.toString('base64');
    const whiteDataUrl = 'data:image/png;base64,' + whiteLogo.toString('base64');

    const header = `<div class="banner-light" style="background-color: #ffffff; text-align: center; padding: 30px 20px; margin-bottom: 20px;">
        <img src="${darkDataUrl}" alt="Cove." width="160" style="height: 80px; width: auto; display: inline-block; border: 0;">
    </div>
    <div class="banner-dark" style="display: none; overflow: hidden; width: 0; max-height: 0; line-height: 0; visibility: hidden;">
        <div style="background-color: #000000; text-align: center; padding: 30px 20px; margin-bottom: 20px;">
            <img src="${whiteDataUrl}" alt="Cove." width="160" style="height: 80px; width: auto; display: inline-block; border: 0;">
        </div>
    </div>`;

    const styles = `
        @media (prefers-color-scheme: dark) {
            .banner-light { display: none !important; }
            .banner-dark { display: block !important; width: auto !important; max-height: none !important; line-height: normal !important; visibility: visible !important; overflow: visible !important; }
        }
    `;

    const body = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${header}
        <h2>Confirmation de commande</h2>
        <p>Bonjour Clemence, merci pour votre commande !</p>
    </div>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>${styles}</style>
</head>
<body style="margin: 0; padding: 0;">${body}</body>
</html>`;
}

test.describe('Visual — bandeau email en mode clair/sombre', () => {

    test('mode clair : bandeau blanc avec logo noir', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.setContent(buildEmailHtml());

        const bannerLight = page.locator('.banner-light');
        await expect(bannerLight).toBeVisible();
        const bg = await bannerLight.evaluate(el => getComputedStyle(el).backgroundColor);
        expect(bg).toBe('rgb(255, 255, 255)');

        const darkDisplay = await page.locator('.banner-dark').evaluate(el => getComputedStyle(el).display);
        expect(darkDisplay).toBe('none');

        await page.screenshot({ path: 'test-results/banner-light.png', fullPage: true });
    });

    test('mode sombre : bandeau noir avec logo blanc', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.setContent(buildEmailHtml());

        const lightDisplay = await page.locator('.banner-light').evaluate(el => getComputedStyle(el).display);
        expect(lightDisplay).toBe('none');

        const bannerDark = page.locator('.banner-dark');
        const darkDisplay = await bannerDark.evaluate(el => getComputedStyle(el).display);
        expect(darkDisplay).not.toBe('none');

        const innerBg = await bannerDark.locator('div').first().evaluate(el => getComputedStyle(el).backgroundColor);
        expect(innerBg).toBe('rgb(0, 0, 0)');

        await page.screenshot({ path: 'test-results/banner-dark.png', fullPage: true });
    });
});
