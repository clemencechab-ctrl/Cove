/**
 * Script de migration one-shot : database.json -> Firebase Realtime Database
 * Usage: node backend/src/data/migrate-to-firebase.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebase');

const DATA_FILE = path.join(__dirname, 'database.json');

async function migrate() {
    console.log('Migration vers Firebase Realtime Database...');

    let data;
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        data = JSON.parse(raw);
        console.log(`Fichier database.json charge: ${data.products?.length || 0} produits, ${data.orders?.length || 0} commandes`);
    } catch (err) {
        console.error('Impossible de lire database.json:', err.message);
        process.exit(1);
    }

    // Migrer les produits (array indexe)
    if (data.products && data.products.length > 0) {
        await db.ref('products').set(data.products);
        console.log(`${data.products.length} produits migres.`);
    }

    // Migrer les commandes (push keys)
    if (data.orders && data.orders.length > 0) {
        const ordersRef = db.ref('orders');
        for (const order of data.orders) {
            await ordersRef.push(order);
        }
        console.log(`${data.orders.length} commandes migrees.`);
    }

    // Migrer le compteur
    if (data.orderCounter) {
        await db.ref('orderCounter').set(data.orderCounter);
        console.log(`Compteur migre: ${data.orderCounter}`);
    }

    console.log('Migration terminee avec succes !');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Erreur de migration:', err);
    process.exit(1);
});
