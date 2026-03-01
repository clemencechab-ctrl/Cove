const nodemailer = require('nodemailer');

// URL publique pour les images produits
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://clemencechab-ctrl.github.io/Cove';

function getImageUrl(image) {
    if (!image) return '';
    return image.startsWith('http') ? image : `${PUBLIC_URL}/${image}`;
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
        await transporter.sendMail(mailOptions);
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
                    ${item.image ? `<img src="${getImageUrl(item.image)}" alt="${item.name}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px;">` : ''}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' — ' + item.size : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const shippingAddress = order.shipping
            ? `${order.shipping.address || ''}, ${order.shipping.postalCode || ''} ${order.shipping.city || ''}, ${order.shipping.country || 'FR'}`
            : 'Non renseignée';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE</h1>
                <h2>Confirmation de commande</h2>
                <p>Bonjour ${order.customer.firstName},</p>
                <p>Merci pour votre commande ! Voici le récapitulatif :</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left;"></th>
                            <th style="padding: 8px; text-align: left;">Produit</th>
                            <th style="padding: 8px; text-align: center;">Qte</th>
                            <th style="padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="text-align: right; margin: 20px 0;">
                    <p>Sous-total : ${(order.subtotal || 0).toFixed(2)} &euro;</p>
                    <p>Livraison : ${(order.shippingCost || 0).toFixed(2)} &euro;</p>
                    <p style="font-size: 1.2em; font-weight: bold;">Total : ${(order.total || 0).toFixed(2)} &euro;</p>
                </div>

                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Adresse de livraison</h3>
                    <p>${shippingAddress}</p>
                </div>

                <p>Vous recevrez un email lorsque votre commande sera expédiée.</p>
                <p>A bientôt,<br>L'équipe COVE</p>
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
                message: 'Votre commande a été confirmée et sera bientôt preparee.'
            },
            processing: {
                subject: `COVE — Votre commande #${order.orderNumber} est en préparation`,
                title: 'Commande en préparation',
                message: 'Votre commande est en cours de preparation dans nos ateliers.'
            },
            label_printed: {
                subject: `COVE — Votre commande #${order.orderNumber} est prête à être expédiée`,
                title: 'Bordereau imprimé',
                message: 'Votre commande a été preparee et le bordereau d\'expedition a été imprimé. L\'expédition est imminente !'
            },
            shipped: {
                subject: `COVE — Votre commande #${order.orderNumber} a ete expédiée`,
                title: 'Commande expédiée',
                message: order.trackingNumber
                    ? `Votre commande a ete expédiée ! Numero de suivi : <strong>${order.trackingNumber}</strong><br><a href="https://www.laposte.fr/outils/suivre-vos-envois?code=${order.trackingNumber}" style="color: #333;">Suivre mon colis sur La Poste</a>`
                    : 'Votre commande a ete expédiée ! Vous la recevrez bientôt.'
            },
            delivered: {
                subject: `COVE — Votre commande #${order.orderNumber} a été livrée`,
                title: 'Commande livrée',
                message: 'Votre commande a été livrée. Nous espérons que vous en serez satisfait(e) !'
            },
            cancelled: {
                subject: `COVE — Votre commande #${order.orderNumber} a été annulée`,
                title: 'Commande annulée',
                message: 'Votre commande a été annulée. Si vous avez des questions, n\'hesitez pas a nous contacter.'
            }
        };

        const info = statusMessages[newStatus];
        if (!info) return;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE</h1>
                <h2>${info.title}</h2>
                <p>Bonjour ${order.customer.firstName},</p>
                <p>${info.message}</p>
                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Commande :</strong> ${order.orderNumber}</p>
                    <p><strong>Statut :</strong> ${info.title}</p>
                </div>
                <p>A bientôt,<br>L'équipe COVE</p>
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
                <h2>Nouveau message de contact</h2>
                <p><strong>Nom:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Sujet:</strong> ${subject || 'Non spécifié'}</p>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <hr>
                <p><small>Message envoye depuis le site COVE</small></p>
            `
        });

        // Confirmation au client
        await sendMail({
            from: getFromAddress(),
            to: email,
            subject: 'COVE - Nous avons bien reçu votre message',
            html: `
                <h2>Merci pour votre message !</h2>
                <p>Bonjour ${name},</p>
                <p>Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.</p>
                <p>Voici un récapitulatif de votre message :</p>
                <blockquote style="border-left: 3px solid #ccc; padding-left: 15px; margin: 20px 0;">
                    ${message.replace(/\n/g, '<br>')}
                </blockquote>
                <p>A bientôt,<br>L'équipe COVE</p>
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
                    ${item.image ? `<img src="${getImageUrl(item.image)}" alt="${item.name}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px;">` : ''}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' — ' + item.size : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const shippingAddress = order.shipping
            ? `${order.shipping.address || ''}, ${order.shipping.postalCode || ''} ${order.shipping.city || ''}, ${order.shipping.country || 'FR'}`
            : 'Non renseignée';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE — Nouvelle commande</h1>
                <p>Une nouvelle commande vient d'être passée !</p>

                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Commande :</strong> ${order.orderNumber}</p>
                    <p><strong>Client :</strong> ${order.customer.firstName} ${order.customer.lastName}</p>
                    <p><strong>Email :</strong> ${order.customer.email}</p>
                    <p><strong>Telephone :</strong> ${order.customer.phone || 'Non renseigné'}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left;"></th>
                            <th style="padding: 8px; text-align: left;">Produit</th>
                            <th style="padding: 8px; text-align: center;">Qte</th>
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
                    <p>Livraison : ${(order.shippingCost || 0).toFixed(2)} &euro;</p>
                    <p style="font-size: 1.2em; font-weight: bold;">Total : ${(order.total || 0).toFixed(2)} &euro;</p>
                </div>

                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Adresse de livraison</h3>
                    <p>${shippingAddress}</p>
                </div>
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
                    <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE</h1>
                    <h2>Demande de ${typeLabel}</h2>
                    <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <p><strong>Commande :</strong> ${order.orderNumber}</p>
                        <p><strong>Client :</strong> ${customerName}</p>
                        <p><strong>Email :</strong> ${customerEmail}</p>
                        <p><strong>Type :</strong> ${typeLabelCap}</p>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
                        <p><strong>Raison :</strong></p>
                        <p>${reason.replace(/\n/g, '<br>')}</p>
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
                    <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE</h1>
                    <h2>Demande de ${typeLabel} reçue</h2>
                    <p>Bonjour${order.customer?.firstName ? ' ' + order.customer.firstName : ''},</p>
                    <p>Nous avons bien reçu votre demande de ${typeLabel} pour la commande <strong>${order.orderNumber}</strong>.</p>
                    <p>Notre equipe va étudier votre demande et vous recontactera dans les plus brefs délais.</p>
                    <p>A bientôt,<br>L'équipe COVE</p>
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
