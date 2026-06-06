// Remplace les produits de la RTDB par les 2 t-shirts COVE (2 couleurs chacun).
//
//   node tests/seed-products.js          -> DRY-RUN : affiche ce qui serait ecrit
//   node tests/seed-products.js apply    -> ecrit reellement dans la RTDB (PROD)
//
// ATTENTION : il n'existe qu'une seule RTDB (covestudio), partagee par le dev
// local et la prod. `apply` ecrase donc immediatement les produits de prod.
// Enchainer le deploiement du nouveau frontend juste apres pour eviter que
// l'ancien frontend tourne avec la nouvelle structure de donnees.
//
// Structure : sizeStock par couleur ({Blanc:{...}, Noir:{...}}) ; images par
// couleur ({Blanc:{main,thumbnails}, Noir:{...}}) ; `image` = images.Blanc.main
// pour la compat API/checkout/Stripe. Le store localise par champ `id`.
const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const STOCK_PER_VARIANT = 20;

function fullSizeStock() {
    const o = {};
    SIZES.forEach(s => { o[s] = STOCK_PER_VARIANT; });
    return o;
}

function sumStock(sizeStock) {
    return Object.values(sizeStock).reduce(
        (tot, perSize) => tot + Object.values(perSize).reduce((a, b) => a + b, 0), 0
    );
}

const covestudio = {
    id: 1,
    name: 'Covestudio',
    description: "T-shirt oversize Covestudio en coton epais premium. Design exclusif COVE.",
    price: 30,
    category: 'tops',
    colors: ['Blanc', 'Noir'],
    images: {
        Blanc: { main: 'image/t-shirt-front.JPG', thumbnails: ['image/t-shirt-front.JPG', 'image/tshirt-back.JPG'] },
        Noir: { main: 'image/new-front.jpeg', thumbnails: ['image/new-front.jpeg', 'image/tshirt-back.JPG'] }
    },
    image: 'image/t-shirt-front.JPG',
    sizeStock: { Blanc: fullSizeStock(), Noir: fullSizeStock() },
    updatedAt: new Date().toISOString()
};
covestudio.stock = sumStock(covestudio.sizeStock);

const grandirSansBruit = {
    id: 2,
    name: 'Grandir sans bruit',
    description: "T-shirt oversize 'Grandir sans bruit' en coton epais premium. Design exclusif COVE.",
    price: 30,
    category: 'tops',
    colors: ['Blanc', 'Noir'],
    images: {
        Blanc: { main: 'image/t-shirt-chat-drole-2.webp', thumbnails: ['image/t-shirt-chat-drole-2.webp', 'image/tshirt-back.JPG'] },
        Noir: { main: 'image/t-shirt-front-stripe.jpg', thumbnails: ['image/t-shirt-front-stripe.jpg', 'image/tshirt-back.JPG'] }
    },
    image: 'image/t-shirt-chat-drole-2.webp',
    sizeStock: { Blanc: fullSizeStock(), Noir: fullSizeStock() },
    updatedAt: new Date().toISOString()
};
grandirSansBruit.stock = sumStock(grandirSansBruit.sizeStock);

const NEW_PRODUCTS = [covestudio, grandirSansBruit];
const apply = process.argv[2] === 'apply';

(async () => {
    try {
        const productsRef = admin.database().ref('products');

        const before = (await productsRef.once('value')).val();
        const beforeList = before
            ? (Array.isArray(before) ? before.filter(Boolean) : Object.values(before))
            : [];
        console.log('Produits actuels :', beforeList.map(p => `${p.id}:${p.name} (${p.price} EUR)`).join(', ') || '(aucun)');
        console.log('\nNouveaux produits :');
        NEW_PRODUCTS.forEach(p => {
            console.log(`  id ${p.id} - ${p.name} - ${p.price} EUR - couleurs [${p.colors.join(', ')}] - stock total ${p.stock}`);
        });

        if (!apply) {
            console.log('\nDRY-RUN (rien ecrit). Relancer avec "apply" pour ecrire reellement.');
            process.exit(0);
        }

        // Remplacer integralement le noeud products (objet indexe par push-key)
        await productsRef.set(null);
        for (const product of NEW_PRODUCTS) {
            await productsRef.push(product);
        }

        const after = Object.values((await productsRef.once('value')).val() || {});
        console.log('\nOK - produits ecrits :', after.map(p => `${p.id}:${p.name}`).join(', '));
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
