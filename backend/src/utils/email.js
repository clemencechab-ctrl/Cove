const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// URL publique pour les images produits
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://clemencechab-ctrl.github.io/Cove';

// Bandeau complet (noir avec logo blanc integre, fusionne en une seule image)
// Une image ne sera pas inversee par Gmail Android en mode sombre.
const BANNER_PATH = path.join(__dirname, '..', '..', '..', 'image', 'email-banner-cove.png');
const BANNER_CID = 'cove-banner';
const LOGO_AVAILABLE = fs.existsSync(BANNER_PATH);

function getImageUrl(image) {
    if (!image) return '';
    return image.startsWith('http') ? image : `${PUBLIC_URL}/${image}`;
}

// Échappe les données contrôlées par l'utilisateur avant interpolation dans le
// HTML des emails (anti-injection / rendu cassé). À utiliser sur tout champ
// provenant du client : nom, email, adresse, message de contact, etc.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// true si la commande est une remise en main propre (pas d'expédition)
function isPickupOrder(order) {
    return order && order.deliveryMethod === 'pickup';
}

// Bandeau complet en UNE image : noir avec logo blanc. Aucun fond CSS, aucun
// texte HTML — Gmail Android ne pourra pas inverser les couleurs.
function getEmailHeader() {
    const src = LOGO_AVAILABLE ? `cid:${BANNER_CID}` : `${PUBLIC_URL}/image/email-banner-cove.png`;
    return `<div style="margin-bottom: 20px; font-size: 0; line-height: 0;">
        <img src="${src}" alt="Cove." width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;">
    </div>`;
}

const EMAIL_HEAD_STYLES = ``;

// Emballe un fragment HTML dans un document complet avec <head> et <style>
// afin que les regles @media prefers-color-scheme soient prises en compte
// par les clients mail (Apple Mail, iOS Mail, Gmail mobile, Outlook.com).
function wrapEmailHtml(bodyHtml, subject = 'COVE') {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(subject)}</title>
    <style>${EMAIL_HEAD_STYLES}</style>
</head>
<body style="margin: 0; padding: 0;">
${bodyHtml}
</body>
</html>`;
}


// Creer le transporter si les variables sont configurees
function createTransporter() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return null;
}

const transporter = createTransporter();

function getFromAddress() {
    return process.env.EMAIL_FROM || 'contact@cove.com';
}

// Envoyer un email (ou log en console si pas de transporter)
async function sendMail(mailOptions) {
    if (transporter) {
        if (typeof mailOptions.html === 'string') {
            // Enveloppe le fragment HTML dans un document complet (avec <head>)
            if (!mailOptions.html.includes('<!DOCTYPE')) {
                mailOptions = { ...mailOptions, html: wrapEmailHtml(mailOptions.html, mailOptions.subject) };
            }
            // Attache le bandeau en CID si l'email l'utilise
            const usesBanner = mailOptions.html.includes(`cid:${BANNER_CID}`);
            if (usesBanner && LOGO_AVAILABLE) {
                mailOptions = {
                    ...mailOptions,
                    attachments: [
                        ...(mailOptions.attachments || []),
                        { filename: 'cove-banner.png', path: BANNER_PATH, cid: BANNER_CID }
                    ]
                };
            }
        }
        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP] to=${JSON.stringify(mailOptions.to)} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} messageId=${info.messageId} response="${info.response}"`);
        if (info.rejected && info.rejected.length) {
            console.warn(`[SMTP] Adresses rejetees: ${JSON.stringify(info.rejected)}`);
        }
        return true;
    }
    console.log('[EMAIL DEMO] To:', mailOptions.to);
    console.log('[EMAIL DEMO] Subject:', mailOptions.subject);
    console.log('[EMAIL DEMO] (Email non envoyé - mode demo)');
    return false;
}

// Email de confirmation de commande
async function sendOrderConfirmation(order) {
    try {
        const itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; width: 60px;">
                    ${item.image ? `<img src="${getImageUrl(item.image)}" alt="${escapeHtml(item.name)}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px;">` : ''}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}${item.size ? ' — ' + escapeHtml(item.size) : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const pickup = isPickupOrder(order);
        const shippingAddress = order.shipping
            ? `${escapeHtml(order.shipping.address || '')}, ${escapeHtml(order.shipping.postalCode || '')} ${escapeHtml(order.shipping.city || '')}, ${escapeHtml(order.shipping.country || 'FR')}`
            : 'Non renseignée';
        const shippingLineLabel = pickup ? 'Remise en main propre' : 'Livraison';
        const receptionBlock = pickup
            ? `<div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Mode de réception</h3>
                    <p>Remise en main propre — vous serez contacté(e) pour convenir d'un rendez-vous.</p>
               </div>`
            : `<div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Adresse de livraison</h3>
                    <p>${shippingAddress}</p>
               </div>`;
        const closingLine = pickup
            ? 'Nous vous contacterons pour organiser la remise de votre commande.'
            : 'Vous recevrez un email lorsque votre commande sera expédiée.';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${getEmailHeader()}
                <h2>Confirmation de commande</h2>
                <p>Bonjour ${escapeHtml(order.customer.firstName)},</p>
                <p>Merci pour votre commande ! Voici le récapitulatif :</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left;"></th>
                            <th style="padding: 8px; text-align: left;">Produit</th>
                            <th style="padding: 8px; text-align: center;">Qté</th>
                            <th style="padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="text-align: right; margin: 20px 0;">
                    <p>Sous-total : ${(order.subtotal || 0).toFixed(2)} &euro;</p>
                    <p>${shippingLineLabel} : ${(order.shippingCost || 0).toFixed(2)} &euro;</p>
                    <p style="font-size: 1.2em; font-weight: bold;">Total : ${(order.total || 0).toFixed(2)} &euro;</p>
                </div>

                ${receptionBlock}

                <p>${closingLine}</p>
                <p>À bientôt,<br>L'équipe COVE</p>
            </div>
        `;

        await sendMail({
            from: getFromAddress(),
            to: order.customer.email,
            subject: `COVE — Confirmation de commande #${order.orderNumber}`,
            html
        });

        console.log(`Email confirmation envoyé pour commande ${order.orderNumber}`);
    } catch (error) {
        console.error(`Erreur envoi email confirmation commande ${order.orderNumber}:`, error.message);
    }
}

// Email de changement de statut
async function sendOrderStatusUpdate(order, newStatus) {
    try {
        const statusMessages = {
            confirmed: {
                subject: `COVE — Votre commande #${order.orderNumber} est confirmée`,
                title: 'Commande confirmée',
                message: 'Votre commande a été confirmée et sera bientôt préparée.'
            },
            processing: {
                subject: `COVE — Votre commande #${order.orderNumber} est en préparation`,
                title: 'Commande en préparation',
                message: 'Votre commande est en cours de préparation dans nos ateliers.'
            },
            label_printed: {
                subject: `COVE — Votre commande #${order.orderNumber} est prête à être expédiée`,
                title: 'Bordereau imprimé',
                message: 'Votre commande a été préparée et le bordereau d\'expédition a été imprimé. L\'expédition est imminente !'
            },
            shipped: {
                subject: `COVE — Votre commande #${order.orderNumber} a été expédiée`,
                title: 'Commande expédiée',
                message: order.trackingNumber
                    ? `Votre commande a été expédiée ! Numéro de suivi : <strong>${escapeHtml(order.trackingNumber)}</strong><br><a href="https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(order.trackingNumber)}" style="color: #333;">Suivre mon colis sur La Poste</a>`
                    : 'Votre commande a été expédiée ! Vous la recevrez bientôt.'
            },
            delivered: {
                subject: `COVE — Votre commande #${order.orderNumber} a été livrée`,
                title: 'Commande livrée',
                message: 'Votre commande a été livrée. Nous espérons que vous en serez satisfait(e) !'
            },
            cancelled: {
                subject: `COVE — Votre commande #${order.orderNumber} a été annulée`,
                title: 'Commande annulée',
                message: 'Votre commande a été annulée. Si vous avez des questions, n\'hésitez pas à nous contacter.'
            }
        };

        const info = statusMessages[newStatus];
        if (!info) return;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${getEmailHeader()}
                <h2>${info.title}</h2>
                <p>Bonjour ${escapeHtml(order.customer.firstName)},</p>
                <p>${info.message}</p>
                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Commande :</strong> ${order.orderNumber}</p>
                    <p><strong>Statut :</strong> ${info.title}</p>
                </div>
                <p>À bientôt,<br>L'équipe COVE</p>
            </div>
        `;

        await sendMail({
            from: getFromAddress(),
            to: order.customer.email,
            subject: info.subject,
            html
        });

        console.log(`Email statut "${newStatus}" envoyé pour commande ${order.orderNumber}`);
    } catch (error) {
        console.error(`Erreur envoi email statut commande ${order.orderNumber}:`, error.message);
    }
}

// Email de contact (notification admin + confirmation client)
async function sendContactNotification(contactData) {
    try {
        const { name, email, subject, message } = contactData;

        // Email a l'admin
        await sendMail({
            from: getFromAddress(),
            to: process.env.EMAIL_USER || getFromAddress(),
            replyTo: email,
            subject: `[COVE Contact] ${subject || 'Nouveau message'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${getEmailHeader()}
                <h2>Nouveau message de contact</h2>
                <p><strong>Nom:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Sujet:</strong> ${escapeHtml(subject || 'Non spécifié')}</p>
                <p><strong>Message:</strong></p>
                <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
                <hr>
                <p><small>Message envoyé depuis le site COVE</small></p>
                </div>
            `
        });

        // Confirmation au client
        await sendMail({
            from: getFromAddress(),
            to: email,
            subject: 'COVE - Nous avons bien reçu votre message',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${getEmailHeader()}
                <h2>Merci pour votre message !</h2>
                <p>Bonjour ${escapeHtml(name)},</p>
                <p>Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.</p>
                <p>Voici un récapitulatif de votre message :</p>
                <blockquote style="border-left: 3px solid #ccc; padding-left: 15px; margin: 20px 0;">
                    ${escapeHtml(message).replace(/\n/g, '<br>')}
                </blockquote>
                <p>À bientôt,<br>L'équipe COVE</p>
                </div>
            `
        });

        console.log(`Email contact envoyé (de: ${email})`);
        return true;
    } catch (error) {
        console.error('Erreur envoi email contact:', error.message);
        return false;
    }
}

// Email de notification au proprietaire pour nouvelle commande
async function sendOrderNotificationToOwner(order) {
    try {
        const ownerEmail = process.env.OWNER_EMAIL || process.env.EMAIL_USER || getFromAddress();

        const itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; width: 60px;">
                    ${item.image ? `<img src="${getImageUrl(item.image)}" alt="${escapeHtml(item.name)}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px;">` : ''}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}${item.size ? ' — ' + escapeHtml(item.size) : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const pickup = isPickupOrder(order);
        const shippingAddress = order.shipping
            ? `${escapeHtml(order.shipping.address || '')}, ${escapeHtml(order.shipping.postalCode || '')} ${escapeHtml(order.shipping.city || '')}, ${escapeHtml(order.shipping.country || 'FR')}`
            : 'Non renseignée';
        const pickupBanner = pickup
            ? `<div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
                    <p style="margin: 0;"><strong>⚠ REMISE EN MAIN PROPRE</strong> — ne pas expédier. Contacter le client pour convenir d'un rendez-vous.</p>
               </div>`
            : '';
        const receptionBlock = pickup
            ? `<div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Mode de réception</h3>
                    <p>Remise en main propre (pas de livraison)</p>
               </div>`
            : `<div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Adresse de livraison</h3>
                    <p>${shippingAddress}</p>
               </div>`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${getEmailHeader()}
                <h2>Nouvelle commande</h2>
                <p>Une nouvelle commande vient d'être passée !</p>
                ${pickupBanner}

                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Commande :</strong> ${order.orderNumber}</p>
                    <p><strong>Client :</strong> ${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}</p>
                    <p><strong>Email :</strong> ${escapeHtml(order.customer.email)}</p>
                    <p><strong>Téléphone :</strong> ${escapeHtml(order.customer.phone || 'Non renseigné')}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left;"></th>
                            <th style="padding: 8px; text-align: left;">Produit</th>
                            <th style="padding: 8px; text-align: center;">Qté</th>
                            <th style="padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="text-align: right; margin: 20px 0;">
                    <p>Sous-total : ${(order.subtotal || 0).toFixed(2)} &euro;</p>
                    ${order.discountAmount ? `<p>Réduction : -${order.discountAmount.toFixed(2)} &euro;</p>` : ''}
                    <p>${pickup ? 'Remise en main propre' : 'Livraison'} : ${(order.shippingCost || 0).toFixed(2)} &euro;</p>
                    <p style="font-size: 1.2em; font-weight: bold;">Total : ${(order.total || 0).toFixed(2)} &euro;</p>
                </div>

                ${receptionBlock}
            </div>
        `;

        await sendMail({
            from: getFromAddress(),
            to: ownerEmail,
            subject: `[COVE] Nouvelle commande #${order.orderNumber} — ${(order.total || 0).toFixed(2)} EUR`,
            html
        });

        console.log(`Email notification proprietaire envoyé pour commande ${order.orderNumber}`);
    } catch (error) {
        console.error(`Erreur envoi email notification proprietaire commande ${order.orderNumber}:`, error.message);
    }
}

// Email de demande d'annulation ou de retour
async function sendCancelReturnRequest(order, type, reason, customerEmail) {
    try {
        const ownerEmail = process.env.OWNER_EMAIL || process.env.EMAIL_USER || getFromAddress();
        const typeLabel = type === 'cancel' ? 'annulation' : 'retour';
        const typeLabelCap = type === 'cancel' ? 'Annulation' : 'Retour';
        const customerName = order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : customerEmail;

        // Email au proprietaire
        await sendMail({
            from: getFromAddress(),
            to: ownerEmail,
            replyTo: customerEmail,
            subject: `[COVE] Demande de ${typeLabel} — Commande #${order.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    ${getEmailHeader()}
                    <h2>Demande de ${typeLabel}</h2>
                    <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <p><strong>Commande :</strong> ${order.orderNumber}</p>
                        <p><strong>Client :</strong> ${escapeHtml(customerName)}</p>
                        <p><strong>Email :</strong> ${escapeHtml(customerEmail)}</p>
                        <p><strong>Type :</strong> ${typeLabelCap}</p>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
                        <p><strong>Raison :</strong></p>
                        <p>${escapeHtml(reason || '').replace(/\n/g, '<br>')}</p>
                    </div>
                    <p>Merci de traiter cette demande dans les plus brefs délais.</p>
                </div>
            `
        });

        // Confirmation au client
        await sendMail({
            from: getFromAddress(),
            to: customerEmail,
            subject: `COVE — Votre demande de ${typeLabel} pour la commande #${order.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    ${getEmailHeader()}
                    <h2>Demande de ${typeLabel} reçue</h2>
                    <p>Bonjour${order.customer?.firstName ? ' ' + escapeHtml(order.customer.firstName) : ''},</p>
                    <p>Nous avons bien reçu votre demande de ${typeLabel} pour la commande <strong>${order.orderNumber}</strong>.</p>
                    <p>Notre équipe va étudier votre demande et vous recontactera dans les plus brefs délais.</p>
                    <p>À bientôt,<br>L'équipe COVE</p>
                </div>
            `
        });

        console.log(`Email demande ${typeLabel} envoyé pour commande ${order.orderNumber}`);
        return true;
    } catch (error) {
        console.error(`Erreur envoi email ${type} commande ${order.orderNumber}:`, error.message);
        return false;
    }
}

module.exports = {
    sendOrderConfirmation,
    sendOrderStatusUpdate,
    sendContactNotification,
    sendOrderNotificationToOwner,
    sendCancelReturnRequest
};
