// One-off : met à jour sizeStock (par couleur) selon le nouvel inventaire du 2026-07-09.
// Usage : node tests/set-sizestock-2026-07-09.js [--dry]
const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const dryRun = process.argv.includes('--dry');

// Covestudio Blanc L/XL non fournis par l'utilisateur -> conservés (3 et 1, valeurs actuelles en base).
const TARGETS = {
    1: { // Covestudio
        Blanc: { XS: 1, S: 6, M: 5, L: 3, XL: 1 },
        Noir:  { XS: 2, S: 3, M: 10, L: 1, XL: 1 }
    },
    2: { // Grandir sans bruit (GSB)
        Blanc: { XS: 2, S: 8, M: 7, L: 2, XL: 1 },
        Noir:  { XS: 3, S: 7, M: 10, L: 3, XL: 1 }
    }
};

function totalOf(sizeStock) {
    let total = 0;
    for (const color of Object.keys(sizeStock)) {
        for (const size of Object.keys(sizeStock[color])) {
            total += sizeStock[color][size];
        }
    }
    return total;
}

(async () => {
    try {
        const productsRef = admin.database().ref('products');
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) throw new Error('Aucun produit dans la RTDB');

        const entries = Array.isArray(data)
            ? data.map((p, i) => [String(i), p]).filter(([, p]) => p)
            : Object.entries(data);

        for (const [id, newSizeStock] of Object.entries(TARGETS)) {
            const found = entries.find(([, p]) => p && p.id === parseInt(id));
            if (!found) {
                console.warn(`! Produit id=${id} introuvable, ignoré`);
                continue;
            }
            const [key, product] = found;
            const oldSizeStock = product.sizeStock;
            const newTotal = totalOf(newSizeStock);

            console.log(`\n"${product.name}" (id ${id})`);
            console.log('  avant:', JSON.stringify(oldSizeStock));
            console.log('  après:', JSON.stringify(newSizeStock), `(stock total: ${newTotal})`);

            if (!dryRun) {
                await productsRef.child(key).child('sizeStock').set(newSizeStock);
                await productsRef.child(key).child('stock').set(newTotal);
            }
        }

        console.log(dryRun ? '\nDRY RUN — rien n\'a été écrit.' : '\nMise à jour appliquée.');
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
