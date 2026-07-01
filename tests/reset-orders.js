// Sauvegarde puis vide /orders dans Firebase RTDB.
// Usage : node tests/reset-orders.js          (dry-run : compte + backup, ne supprime PAS)
//         node tests/reset-orders.js --apply   (backup PUIS suppression)
const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '..', 'backend');
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });
const { db } = require('../backend/src/config/firebase');

const APPLY = process.argv.includes('--apply');

(async () => {
    const snap = await db.ref('orders').once('value');
    const orders = snap.val() || {};
    const ids = Object.keys(orders);
    console.log(`Commandes trouvées : ${ids.length}`);

    const backupPath = path.join(
        'C:/Users/cleme/AppData/Local/Temp/claude/C--Clemcove-Cove/303c3d56-6d52-4fc9-b4c4-1872132d1948/scratchpad',
        `orders-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(backupPath, JSON.stringify(orders, null, 2));
    console.log(`Backup écrit : ${backupPath}`);

    if (!APPLY) {
        console.log('DRY-RUN : aucune suppression. Relancer avec --apply pour vider /orders.');
        process.exit(0);
    }

    await db.ref('orders').remove();
    console.log('✅ /orders supprimé.');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
