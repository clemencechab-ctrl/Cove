// Previsualise le site COVE en mode mobile (iPhone 13) sur prod.
// Chromium visible + screenshots pour chaque page cle.
// Lancer : node tests/mobile-preview.js

const { chromium, devices } = require('playwright');
const fs = require('fs');

const PROD = 'https://covestudio.fr';
const PAGES = [
    { url: '/', name: 'home' },
    { url: '/shop.html', name: 'shop' },
    { url: '/produit-tshirt.html', name: 'produit-tshirt' },
    { url: '/cart.html', name: 'cart' },
    { url: '/faq.html', name: 'faq' },
    { url: '/contact.html', name: 'contact' },
    { url: '/compte.html', name: 'compte' },
    { url: '/about.html', name: 'about' },
];

(async () => {
    fs.mkdirSync('test-results/mobile', { recursive: true });
    const iPhone = devices['iPhone 13'];
    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();

    console.log(`\nViewport : ${iPhone.viewport.width} x ${iPhone.viewport.height} (iPhone 13)\n`);

    for (const p of PAGES) {
        const url = `${PROD}${p.url}`;
        console.log(`→ ${p.name.padEnd(18)} ${url}`);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(1500);
            // Scroll un peu en bas puis remonte pour charger les lazy images et voir le full layout
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(800);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(500);
            const out = `test-results/mobile/${p.name}.png`;
            await page.screenshot({ path: out, fullPage: true });
            console.log(`   OK -> ${out}`);
        } catch (e) {
            console.log(`   ERROR: ${e.message}`);
        }
    }

    // Capture speciale : FAQ avec 2 items ouverts pour montrer l'accordion
    console.log(`\n→ faq (accordion ouvert)`);
    await page.goto(`${PROD}/faq.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const buttons = await page.locator('.faq-question').all();
    if (buttons.length >= 4) {
        await buttons[0].click();
        await page.waitForTimeout(400);
        await buttons[4].click();
        await page.waitForTimeout(600);
    }
    await page.screenshot({ path: 'test-results/mobile/faq-open.png', fullPage: true });
    console.log(`   OK -> test-results/mobile/faq-open.png`);

    console.log(`\nToutes les captures dans : test-results/mobile/`);
    console.log('La fenetre Chromium reste ouverte 10s pour que tu voies.');
    await page.waitForTimeout(10000);
    await browser.close();
})();
