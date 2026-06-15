// RGPD — outil operateur (owner) pour honorer les demandes RGPD en prod.
//
// Usage :
//   node tests/rgpd.js erase <email> [--apply]   -> anonymise les commandes d'un client
//                                                    et supprime son compte (RTDB + Auth)
//   node tests/rgpd.js retention [--apply]        -> liste/purge les clients dont la
//                                                    derniere activite depasse la duree
//                                                    de conservation (3 ans)
//
// Sans --apply : DRY-RUN, n'ecrit RIEN, affiche seulement ce qui serait fait.
//
// Conforme a confidentialite.html : donnees clients conservees 3 ans apres le dernier
// achat ; donnees de commande conservees 10 ans (obligation legale). On ne supprime donc
// jamais les commandes : on anonymise uniquement les donnees personnelles qu'elles
// contiennent (nom, email, telephone, adresse), en gardant montants / articles / dates.

const { admin } = require('../backend/src/config/firebase');
const store = require('../backend/src/data/store');

const RETENTION_YEARS = 3;

function maxDate(...isos) {
    const ts = isos.map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    return ts.length ? new Date(Math.max(...ts)) : null;
}

// Derniere activite d'un client = max(derniere commande, lastLogin, createdAt)
function lastActivity(user, orders) {
    const own = orders.filter(o =>
        o.userId === user.uid || (user.email && o.customer && o.customer.email === user.email));
    const orderDates = own.map(o => o.createdAt).filter(Boolean);
    return maxDate(...orderDates, user.lastLogin, user.createdAt);
}

async function eraseUid(uid, label, apply) {
    if (!apply) {
        console.log(`   [DRY] anonymiserait + supprimerait ${label}`);
        return;
    }
    const r = await store.eraseUserData(uid);
    let authMsg = 'Auth supprime';
    try {
        await admin.auth().deleteUser(uid);
    } catch (e) {
        authMsg = `Auth non supprime (${e && e.message})`;
    }
    console.log(`   [OK] ${label} : ${r.anonymizedOrders} commande(s) anonymisee(s), fiche RTDB supprimee, ${authMsg}`);
}

(async () => {
    const cmd = process.argv[2];
    const apply = process.argv.includes('--apply');

    if (cmd === 'erase') {
        const email = process.argv[3];
        if (!email || email.startsWith('--')) {
            console.error('Usage: node tests/rgpd.js erase <email> [--apply]');
            process.exit(1);
        }
        const users = await store.getAllUsers();
        const user = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
        if (!user) {
            console.error(`Aucun compte avec l'email ${email}.`);
            process.exit(1);
        }
        if (user.role === 'owner') {
            console.error('Refus : ce compte est owner. Effacement annule.');
            process.exit(1);
        }
        console.log(`${apply ? 'EFFACEMENT' : 'DRY-RUN'} — demande RGPD pour ${email} (uid=${user.uid})`);
        await eraseUid(user.uid, email, apply);
        if (!apply) console.log('\nRien ecrit. Relancer avec --apply pour appliquer.');
        process.exit(0);
    }

    if (cmd === 'retention') {
        const users = await store.getAllUsers();
        const orders = await store.getOrders();
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

        const stale = users
            .filter(u => u.role !== 'owner')
            .map(u => ({ u, last: lastActivity(u, orders) }))
            .filter(({ last }) => last && last < cutoff);

        console.log(`${apply ? 'PURGE' : 'DRY-RUN'} — clients inactifs depuis > ${RETENTION_YEARS} ans (avant ${cutoff.toISOString().slice(0, 10)})`);
        if (!stale.length) {
            console.log('   Aucun client a purger.');
            process.exit(0);
        }
        for (const { u, last } of stale) {
            console.log(` - ${u.email} (uid=${u.uid}, derniere activite ${last.toISOString().slice(0, 10)})`);
            await eraseUid(u.uid, u.email, apply);
        }
        if (!apply) console.log('\nRien ecrit. Relancer avec --apply pour appliquer.');
        process.exit(0);
    }

    console.error('Usage:\n  node tests/rgpd.js erase <email> [--apply]\n  node tests/rgpd.js retention [--apply]');
    process.exit(1);
})();
