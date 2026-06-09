// Modifie les prix produits dans la RTDB prod (ce qui est réellement débité par Stripe).
// Usage :
//   node tests/set-product-prices.js test      -> les 2 tees (id 1 et id 2) à 1 EUR
//   node tests/set-product-prices.js restore   -> remet les 2 tees à 30 EUR
//
// Le store lit `products` soit en tableau, soit en objet indexé par push-key
// (cf. backend/src/data/store.js). Ce script gère les deux cas et localise les
// produits par leur champ `id` (1 et 2), comme getProductById.
const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

// Prix cibles selon le mode
const PRICES = {
    test:    { 1: 1,  2: 1 },   // bas prix pour tester un vrai paiement
    restore: { 1: 30, 2: 30 }   // vrais prix de production (2 tees à 30)
};

const mode = process.argv[2];
if (!PRICES[mode]) {
    console.error('Usage: node tests/set-product-prices.js <test|restore>');
    process.exit(1);
}

(async () => {
    try {
        const productsRef = admin.database().ref('products');
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) throw new Error('Aucun produit dans la RTDB');

        // Construire la liste [key, product] quel que soit le format de stockage
        const entries = Array.isArray(data)
            ? data.map((p, i) => [String(i), p]).filter(([, p]) => p)
            : Object.entries(data);

        const targets = PRICES[mode];
        for (const [id, newPrice] of Object.entries(targets)) {
            const found = entries.find(([, p]) => p && p.id === parseInt(id));
            if (!found) {
                console.warn(`! Produit id=${id} introuvable, ignoré`);
                continue;
            }
            const [key, product] = found;
            const oldPrice = product.price;
            await productsRef.child(key).child('price').set(newPrice);
            console.log(`OK - "${product.name}" (id ${id}) : ${oldPrice} -> ${newPrice} EUR`);
        }

        console.log(`\nMode "${mode}" appliqué.`);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
