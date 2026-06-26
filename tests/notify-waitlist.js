#!/usr/bin/env node
/*
 * notify-waitlist.js — envoie l'alerte "drop" à tous les inscrits de la liste
 * d'attente (pré-lancement). À lancer LE JOUR DE L'OUVERTURE, une fois le verrou
 * privé retiré (`node tests/gate.js remove`) et le site déployé.
 *
 *   node tests/notify-waitlist.js          → dry-run : liste les destinataires, n'envoie rien
 *   node tests/notify-waitlist.js --send    → envoie réellement les emails
 *
 * Idempotent : seuls les inscrits avec notified=false sont contactés ; chaque
 * envoi réussi passe notified=true (relancer le script ne redouble pas les envois).
 * Doit tourner avec le même environnement que le backend (backend/.env), car il
 * réutilise le transporteur SMTP et la connexion Firebase Admin.
 */
const path = require('path');
const backendDir = path.join(__dirname, '..', 'backend');
// dotenv vit dans backend/node_modules ; on charge backend/.env pour récupérer les
// identifiants SMTP (EMAIL_*). Firebase, lui, se connecte via le JSON à la racine.
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });

// backend/.env définit FRONTEND_URL=http://localhost:3000 (mode test) — on force
// l'URL prod pour que le bouton de l'email pointe bien vers la boutique en ligne.
process.env.FRONTEND_URL = process.env.DROP_URL || 'https://covestudio.fr';

const store = require('../backend/src/data/store');
const { sendDropAlert } = require('../backend/src/utils/email');

const SEND = process.argv.includes('--send');

(async () => {
    const list = await store.getWaitlist();
    const pending = list.filter(e => !e.notified);

    console.log(`Liste d'attente : ${list.length} inscrit(s), ${pending.length} à notifier.`);
    if (!SEND) {
        console.log('\n[DRY-RUN] Aucun email envoyé. Destinataires qui seraient contactés :');
        pending.forEach(e => console.log('  - ' + e.email));
        console.log('\nRelance avec --send pour envoyer réellement.');
        process.exit(0);
    }

    let sent = 0, failed = 0;
    for (const entry of pending) {
        try {
            await sendDropAlert(entry.email);
            await store.markWaitlistNotified(entry._key);
            sent++;
            console.log('  ✓ ' + entry.email);
        } catch (err) {
            failed++;
            console.error('  ✗ ' + entry.email + ' — ' + (err && err.message));
        }
    }
    console.log(`\nTerminé : ${sent} envoyé(s), ${failed} échec(s).`);
    process.exit(failed ? 1 : 0);
})();
