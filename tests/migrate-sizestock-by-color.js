// Migre sizeStock du format PLAT (partagé entre couleurs) vers le format
// IMBRIQUÉ par couleur : sizeStock = { "Blanc": {XS..XL}, "Noir": {XS..XL} }.
// Le backend (store.updateProductStock) gère déjà ce format imbriqué.
//
// Répartition : les valeurs plates actuelles sont placées sur la PREMIÈRE
// couleur (Blanc), les autres couleurs démarrent à 0. À ajuster ensuite dans
// l'admin. Le champ agrégé `stock` est recalculé = somme de toutes les cases.
//
// Idempotent : un produit déjà imbriqué (une couleur a une valeur objet) est
// ignoré. Usage : node tests/migrate-sizestock-by-color.js [--dry]
const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const DRY = process.argv.includes('--dry');

function isNested(ss, colors) {
    if (!ss || typeof ss !== 'object') return false;
    return (colors || []).some(c => ss[c] && typeof ss[c] === 'object');
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

        for (const [key, product] of entries) {
            const colors = Array.isArray(product.colors) ? product.colors : [];
            if (!colors.length) {
                console.log(`- "${product.name}" : pas de couleurs, ignoré`);
                continue;
            }
            const ss = product.sizeStock || {};
            if (isNested(ss, colors)) {
                console.log(`- "${product.name}" : déjà imbriqué, ignoré`);
                continue;
            }

            const nested = {};
            let total = 0;
            colors.forEach((color, idx) => {
                nested[color] = {};
                SIZES.forEach(size => {
                    const val = idx === 0 ? (parseInt(ss[size]) || 0) : 0;
                    nested[color][size] = val;
                    total += val;
                });
            });

            console.log(`OK - "${product.name}" (id ${product.id}) -> ${JSON.stringify(nested)} | stock=${total}`);
            if (!DRY) {
                await productsRef.child(key).update({ sizeStock: nested, stock: total });
            }
        }

        console.log(DRY ? '\n(dry-run : aucune écriture)' : '\nMigration appliquée.');
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
