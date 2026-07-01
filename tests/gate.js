#!/usr/bin/env node
/*
 * gate.js — pose ou retire le verrou d'accès privé (pré-lancement) sur toutes
 * les pages HTML du site (FR + EN).
 *
 *   node tests/gate.js add      → insère le script de garde dans chaque page
 *   node tests/gate.js remove   → retire le script de garde de chaque page
 *
 * Le jour de l'ouverture (01/07/2026) :
 *   node tests/gate.js remove   (puis redéployer, et supprimer coming-soon.html)
 *
 * Idempotent : "add" deux fois n'insère qu'une fois ; "remove" sur une page
 * non verrouillée ne fait rien.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Marqueurs uniques qui encadrent le bloc injecté (servent au retrait).
const START = '<!-- COVE-GATE-START — verrou pré-lancement, retiré via `node tests/gate.js remove` -->';
const END = '<!-- COVE-GATE-END -->';

const BLOCK = `    ${START}
    <script>
    (function () {
        try { if (localStorage.getItem('coveAccess') === 'GRANTED') return; } catch (e) {}
        window.location.replace('/coming-soon.html');
    })();
    </script>
    ${END}
`;

// Pages du site à protéger. On exclut coming-soon.html (la page d'attente
// elle-même) et tout ce qui n'est pas une vraie page client.
const FILES = [
    'index.html', 'shop.html', 'cart.html', 'compte.html', 'success.html',
    'contact.html', 'faq.html', 'cgv.html', 'retours.html',
    'confidentialite.html', 'mentions-legales.html',
    'produit-tshirt.html', 'produit-hoodie.html', 'admin.html',
    'en/index.html', 'en/shop.html', 'en/cart.html', 'en/compte.html',
    'en/success.html', 'en/contact.html', 'en/faq.html',
    'en/produit-tshirt.html', 'en/produit-hoodie.html', 'en/admin.html',
];

const mode = process.argv[2];
if (mode !== 'add' && mode !== 'remove') {
    console.error('Usage: node tests/gate.js add|remove');
    process.exit(1);
}

let changed = 0, skipped = 0, missing = 0;

for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { console.warn('  (absent) ' + rel); missing++; continue; }

    let html = fs.readFileSync(file, 'utf8');
    const has = html.includes(START);

    if (mode === 'add') {
        if (has) { skipped++; continue; }
        // Insère juste avant la fermeture du <head> pour s'exécuter avant le rendu du body.
        const idx = html.indexOf('</head>');
        if (idx === -1) { console.warn('  (pas de </head>) ' + rel); missing++; continue; }
        html = html.slice(0, idx) + BLOCK + html.slice(idx);
        fs.writeFileSync(file, html);
        changed++;
    } else {
        if (!has) { skipped++; continue; }
        const re = new RegExp('[ \\t]*' + escapeRe(START) + '[\\s\\S]*?' + escapeRe(END) + '\\r?\\n?', 'g');
        html = html.replace(re, '');
        fs.writeFileSync(file, html);
        changed++;
    }
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

console.log(`\n${mode === 'add' ? 'Verrou posé' : 'Verrou retiré'} : ${changed} page(s) modifiée(s), ${skipped} inchangée(s)${missing ? ', ' + missing + ' absente(s)' : ''}.`);
