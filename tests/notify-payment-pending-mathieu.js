// One-off : prévient Mathieu Combe (commande COVE-1096) que son paiement n'a
// jamais abouti (session Stripe expirée) et que sa commande est restée en
// attente / n'a pas été validée.
//
// Usage :
//   node tests/notify-payment-pending-mathieu.js --dry   -> écrit l'aperçu HTML dans scratch-preview.html, n'envoie rien
//   node tests/notify-payment-pending-mathieu.js --send  -> envoie réellement l'email

process.env.PUBLIC_URL = 'https://covestudio.fr'; // avant le require('email.js') (lu à l'import, cf. CLAUDE.md)
require('../backend/node_modules/dotenv').config({ path: 'backend/.env', quiet: true });

const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const fs = require('fs');
const serviceAccount = require(path.resolve(__dirname, '../covestudio-firebase-adminsdk-fbsvc-854611e7e9.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app'
});

const ORDER_KEY = '-Owxccp6jf7NZJEhc5Yn'; // COVE-1096
const mode = process.argv.includes('--send') ? 'send' : 'dry';

(async () => {
    const snap = await admin.database().ref('orders/' + ORDER_KEY).once('value');
    const order = snap.val();
    if (!order) throw new Error('Commande introuvable');

    const email = require('../backend/src/utils/email');

    if (mode === 'dry') {
        // Génère le même HTML que sendPaymentPendingNotice sans passer par sendMail (pas d'envoi).
        // On duplique juste l'appel interne en patchant temporairement le transporter serait trop
        // invasif : on log le contenu textuel clé pour relecture rapide + écrit l'aperçu complet.
        const outPath = path.resolve(__dirname, '../scratch-preview-payment-pending.html');

        // Recompose le HTML localement (même gabarit que email.js) pour un aperçu fidèle sans envoi.
        const itemsHtml = (order.items || []).map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; width: 60px;"></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' — ' + item.size : ''}${item.color ? ' — ' + item.color : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const html = `<!doctype html><html><body style="margin:0;padding:0;">
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; border:1px solid #eee;">
            <div style="background:#000;color:#fff;padding:20px;text-align:center;font-weight:bold;letter-spacing:0.1em;">COVE.</div>
            <div style="padding: 20px;">
            <h2>Votre commande n'a pas été finalisée</h2>
            <p>Bonjour ${order.customer.firstName},</p>
            <p>Vous avez récemment commencé une commande sur COVE (référence <strong>${order.orderNumber}</strong>), mais le paiement n'a pas abouti : <strong>aucune somme n'a été débitée</strong> et votre commande est restée en attente, elle n'a donc pas été validée ni préparée.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead><tr style="background: #f5f5f5;"><th></th><th style="text-align:left;padding:8px;">Produit</th><th style="padding:8px;">Qté</th><th style="padding:8px;text-align:right;">Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <p>Si vous souhaitez toujours vous procurer ces articles, vous pouvez repasser commande directement depuis la boutique :</p>
            <p style="text-align:center; margin: 24px 0;"><a href="https://covestudio.fr/shop.html" style="display:inline-block; background:#000; color:#fff; text-decoration:none; padding:14px 32px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; font-size:14px;">Retourner sur la boutique</a></p>
            <p>Si vous avez déjà réglé cette commande par un autre moyen ou rencontrez un souci, répondez simplement à cet email, nous reviendrons vers vous rapidement.</p>
            <p>À bientôt,<br>L'équipe COVE</p>
            </div>
        </div>
        </body></html>`;

        fs.writeFileSync(outPath, html, 'utf8');
        console.log('APERÇU (rien envoyé) :');
        console.log('  À      :', order.customer.email);
        console.log('  Sujet  :', `COVE — Votre commande #${order.orderNumber} n'a pas été finalisée`);
        console.log('  Fichier:', outPath);
    } else {
        await email.sendPaymentPendingNotice(order);
        console.log('Email envoyé à', order.customer.email);
    }

    process.exit(0);
})().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
