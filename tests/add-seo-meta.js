// Script one-shot : ajoute les meta SEO (description, canonical, hreflang,
// OG, Twitter, favicon) dans toutes les pages HTML du site.
//
// Lancer : node tests/add-seo-meta.js

const fs = require('fs');
const path = require('path');

const SITE = 'https://covestudio.fr';

// Config par page : titre + description
const PAGES = {
    // FR
    'shop.html':                { title: 'Boutique — T-shirts & Hoodies Streetwear | COVE Studio',         desc: 'Découvrez la boutique COVE Studio : t-shirts et hoodies streetwear premium, coupes oversize, livraison rapide en France.', enPath: 'en/shop.html' },
    'produit-tshirt.html':      { title: 'T-shirt Cove — Streetwear Premium Oversize | COVE Studio',      desc: 'T-shirt COVE Studio en coton épais 220g/m². Coupe oversize, design exclusif. Livraison France sous 2-5 jours. 30 EUR.', enPath: 'en/produit-tshirt.html' },
    'produit-hoodie.html':      { title: 'Hoodie Picnic — Sweat Oversize Premium | COVE Studio',          desc: 'Hoodie Picnic COVE Studio en coton premium. Coupe oversize, confort absolu. Livraison rapide en France. 80 EUR.', enPath: 'en/produit-hoodie.html' },
    'about.html':               { title: 'Notre Histoire — COVE Studio',                                   desc: 'Découvrez l\'histoire de COVE Studio, marque française de streetwear premium : authenticité, qualité, accessibilité.', enPath: 'en/about.html' },
    'faq.html':                 { title: 'FAQ — Questions fréquentes | COVE Studio',                      desc: 'Réponses aux questions fréquentes sur COVE Studio : livraison, retours, tailles, paiement, données personnelles.', enPath: 'en/faq.html' },
    'contact.html':             { title: 'Contact — COVE Studio',                                          desc: 'Contactez l\'équipe COVE Studio : une question ? Écrivez-nous à cove.off@gmail.com. Réponse sous 24-48h.', enPath: 'en/contact.html' },
    'retours.html':             { title: 'Politique de Retour — COVE Studio',                              desc: 'Retour sous 14 jours chez COVE Studio : conditions, frais, délais de remboursement. Satisfaction garantie.' },
    'cgv.html':                 { title: 'Conditions Générales de Vente — COVE Studio',                   desc: 'CGV COVE Studio : modalités de commande, livraison, paiement, droit de rétractation.' },
    'mentions-legales.html':    { title: 'Mentions Légales — COVE Studio',                                 desc: 'Mentions légales de COVE Studio, marque française de streetwear premium.' },
    'confidentialite.html':     { title: 'Politique de Confidentialité — COVE Studio',                    desc: 'Politique de confidentialité COVE Studio : protection de vos données personnelles conforme au RGPD.' },
    // EN
    'en/index.html':            { title: 'COVE Studio — French Premium Streetwear | Summer 2026 Collection', desc: 'COVE Studio — French premium streetwear brand. Discover the Summer 2026 collection: quality cotton t-shirts and hoodies, oversized fits, exclusive designs.', frPath: 'index.html', isHome: true },
    'en/shop.html':             { title: 'Shop — Streetwear T-shirts & Hoodies | COVE Studio',            desc: 'Discover COVE Studio shop: premium streetwear t-shirts and hoodies, oversized fits, fast shipping.', frPath: 'shop.html' },
    'en/produit-tshirt.html':   { title: 'Cove T-shirt — Premium Oversized Streetwear | COVE Studio',     desc: 'COVE Studio t-shirt in 220g/m² heavy cotton. Oversized cut, exclusive design. 30 EUR.', frPath: 'produit-tshirt.html' },
    'en/produit-hoodie.html':   { title: 'Picnic Hoodie — Premium Oversized Sweatshirt | COVE Studio',    desc: 'Picnic Hoodie by COVE Studio in premium cotton. Oversized fit, ultimate comfort. 80 EUR.', frPath: 'produit-hoodie.html' },
    'en/about.html':            { title: 'Our Story — COVE Studio',                                        desc: 'Discover the story of COVE Studio, French premium streetwear brand: authenticity, quality, accessibility.', frPath: 'about.html' },
    'en/faq.html':              { title: 'FAQ — Frequently Asked Questions | COVE Studio',               desc: 'Answers to the most frequent questions about COVE Studio: shipping, returns, sizing, payment, personal data.', frPath: 'faq.html' },
    'en/contact.html':          { title: 'Contact — COVE Studio',                                          desc: 'Contact the COVE Studio team: a question? Email us at cove.off@gmail.com. Reply within 24-48h.', frPath: 'contact.html' }
};

function buildHreflangAndCanonical(pageRel, cfg) {
    const lines = [];
    const canonicalUrl = `${SITE}/${pageRel === 'index.html' ? '' : pageRel}`;
    lines.push(`    <link rel="canonical" href="${canonicalUrl}">`);
    if (cfg.enPath && cfg.frPath === undefined) {
        const frUrl = `${SITE}/${pageRel === 'index.html' ? '' : pageRel}`;
        const enUrl = `${SITE}/${cfg.enPath}`;
        lines.push(`    <link rel="alternate" hreflang="fr" href="${frUrl}">`);
        lines.push(`    <link rel="alternate" hreflang="en" href="${enUrl}">`);
        lines.push(`    <link rel="alternate" hreflang="x-default" href="${frUrl}">`);
    } else if (cfg.frPath) {
        const frUrl = `${SITE}/${cfg.frPath}`;
        const enUrl = `${SITE}/${pageRel}`;
        lines.push(`    <link rel="alternate" hreflang="fr" href="${frUrl}">`);
        lines.push(`    <link rel="alternate" hreflang="en" href="${enUrl}">`);
        lines.push(`    <link rel="alternate" hreflang="x-default" href="${frUrl}">`);
    }
    return lines.join('\n');
}

function buildSeoBlock(pageRel, cfg) {
    const pagePath = pageRel.replace('\\', '/');
    const canonicalUrl = `${SITE}/${pagePath === 'index.html' ? '' : pagePath}`;
    const ogImage = `${SITE}/image/logo-cove.png`;
    const inEn = pagePath.startsWith('en/');
    const faviconPath = inEn ? '../image/logo-cove.png' : 'image/logo-cove.png';
    const lang = inEn ? 'en' : 'fr';
    const locale = inEn ? 'en_US' : 'fr_FR';
    const altLocale = inEn ? 'fr_FR' : 'en_US';

    return `    <!-- SEO -->
    <title>${cfg.title}</title>
    <meta name="description" content="${cfg.desc}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="author" content="COVE Studio">

${buildHreflangAndCanonical(pagePath, cfg)}

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="COVE Studio">
    <meta property="og:title" content="${cfg.title}">
    <meta property="og:description" content="${cfg.desc}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:locale" content="${locale}">
    <meta property="og:locale:alternate" content="${altLocale}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${cfg.title}">
    <meta name="twitter:description" content="${cfg.desc}">
    <meta name="twitter:image" content="${ogImage}">

    <!-- Favicon + theme -->
    <link rel="icon" type="image/png" href="${faviconPath}">
    <link rel="apple-touch-icon" href="${faviconPath}">
    <meta name="theme-color" content="#000000">`;
}

let touched = 0;
for (const [rel, cfg] of Object.entries(PAGES)) {
    const fullPath = path.join(__dirname, '..', rel);
    if (!fs.existsSync(fullPath)) { console.log(`SKIP (absent): ${rel}`); continue; }
    let html = fs.readFileSync(fullPath, 'utf8');

    // Si deja fait (presence de og:type), on passe
    if (html.includes('og:type') && html.includes('canonical')) {
        console.log(`SKIP (deja SEO): ${rel}`);
        continue;
    }

    // Remplace le bloc <title>...<link href="fonts...> par le bloc SEO + ensuite les links existants pour CSS/fonts
    // Plus simple : on remplace juste le <title> par le bloc SEO complet (qui inclut le nouveau titre)
    const titleRegex = /\n?\s*<title>[^<]*<\/title>\s*\n?/;
    if (!titleRegex.test(html)) {
        console.log(`SKIP (pas de <title>): ${rel}`);
        continue;
    }
    const seoBlock = buildSeoBlock(rel, cfg);
    html = html.replace(titleRegex, '\n' + seoBlock + '\n');

    fs.writeFileSync(fullPath, html);
    console.log(`OK: ${rel}`);
    touched++;
}
console.log(`\nTotal : ${touched} fichier(s) modifie(s)`);
