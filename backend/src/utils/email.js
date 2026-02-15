const nodemailer = require('nodemailer');

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
    console.log('[EMAIL DEMO] (Email non envoye - mode demo)');
    return false;
}

// Email de confirmation de commande
async function sendOrderConfirmation(order) {
    try {
        const itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' — ' + item.size : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const shippingAddress = order.shipping
            ? `${order.shipping.address || ''}, ${order.shipping.postalCode || ''} ${order.shipping.city || ''}, ${order.shipping.country || 'FR'}`
            : 'Non renseignee';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE</h1>
                <h2>Confirmation de commande</h2>
                <p>Bonjour ${order.customer.firstName},</p>
                <p>Merci pour votre commande ! Voici le recapitulatif :</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
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

                <p>Vous recevrez un email lorsque votre commande sera expediee.</p>
                <p>A bientot,<br>L'equipe COVE</p>
            </div>
        `;

        await sendMail({
            from: getFromAddress(),
            to: order.customer.email,
            subject: `COVE — Confirmation de commande #${order.orderNumber}`,
            html
        });

        console.log(`Email confirmation envoye pour commande ${order.orderNumber}`);
    } catch (error) {
        console.error(`Erreur envoi email confirmation commande ${order.orderNumber}:`, error.message);
    }
}

// Email de changement de statut
async function sendOrderStatusUpdate(order, newStatus) {
    try {
        const statusMessages = {
            confirmed: {
                subject: `COVE — Votre commande #${order.orderNumber} est confirmee`,
                title: 'Commande confirmee',
                message: 'Votre commande a ete confirmee et sera bientot preparee.'
            },
            processing: {
                subject: `COVE — Votre commande #${order.orderNumber} est en preparation`,
                title: 'Commande en preparation',
                message: 'Votre commande est en cours de preparation dans nos ateliers.'
            },
            shipped: {
                subject: `COVE — Votre commande #${order.orderNumber} a ete expediee`,
                title: 'Commande expediee',
                message: order.trackingNumber
                    ? `Votre commande a ete expediee ! Numero de suivi : <strong>${order.trackingNumber}</strong><br><a href="https://www.laposte.fr/outils/suivre-vos-envois?code=${order.trackingNumber}" style="color: #333;">Suivre mon colis sur La Poste</a>`
                    : 'Votre commande a ete expediee ! Vous la recevrez bientot.'
            },
            delivered: {
                subject: `COVE — Votre commande #${order.orderNumber} a ete livree`,
                title: 'Commande livree',
                message: 'Votre commande a ete livree. Nous esperons que vous en serez satisfait(e) !'
            },
            cancelled: {
                subject: `COVE — Votre commande #${order.orderNumber} a ete annulee`,
                title: 'Commande annulee',
                message: 'Votre commande a ete annulee. Si vous avez des questions, n\'hesitez pas a nous contacter.'
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
                <p>A bientot,<br>L'equipe COVE</p>
            </div>
        `;

        await sendMail({
            from: getFromAddress(),
            to: order.customer.email,
            subject: info.subject,
            html
        });

        console.log(`Email statut "${newStatus}" envoye pour commande ${order.orderNumber}`);
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
                <p><strong>Sujet:</strong> ${subject || 'Non specifie'}</p>
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
            subject: 'COVE - Nous avons bien recu votre message',
            html: `
                <h2>Merci pour votre message !</h2>
                <p>Bonjour ${name},</p>
                <p>Nous avons bien recu votre message et nous vous repondrons dans les plus brefs delais.</p>
                <p>Voici un recapitulatif de votre message :</p>
                <blockquote style="border-left: 3px solid #ccc; padding-left: 15px; margin: 20px 0;">
                    ${message.replace(/\n/g, '<br>')}
                </blockquote>
                <p>A bientot,<br>L'equipe COVE</p>
            `
        });

        console.log(`Email contact envoye (de: ${email})`);
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
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' — ' + item.size : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} &euro;</td>
            </tr>
        `).join('');

        const shippingAddress = order.shipping
            ? `${order.shipping.address || ''}, ${order.shipping.postalCode || ''} ${order.shipping.city || ''}, ${order.shipping.country || 'FR'}`
            : 'Non renseignee';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">COVE — Nouvelle commande</h1>
                <p>Une nouvelle commande vient d'etre passee !</p>

                <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Commande :</strong> ${order.orderNumber}</p>
                    <p><strong>Client :</strong> ${order.customer.firstName} ${order.customer.lastName}</p>
                    <p><strong>Email :</strong> ${order.customer.email}</p>
                    <p><strong>Telephone :</strong> ${order.customer.phone || 'Non renseigne'}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
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
                    ${order.discountAmount ? `<p>Reduction : -${order.discountAmount.toFixed(2)} &euro;</p>` : ''}
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

        console.log(`Email notification proprietaire envoye pour commande ${order.orderNumber}`);
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
                    <p>Merci de traiter cette demande dans les plus brefs delais.</p>
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
                    <h2>Demande de ${typeLabel} recue</h2>
                    <p>Bonjour${order.customer?.firstName ? ' ' + order.customer.firstName : ''},</p>
                    <p>Nous avons bien recu votre demande de ${typeLabel} pour la commande <strong>${order.orderNumber}</strong>.</p>
                    <p>Notre equipe va etudier votre demande et vous recontactera dans les plus brefs delais.</p>
                    <p>A bientot,<br>L'equipe COVE</p>
                </div>
            `
        });

        console.log(`Email demande ${typeLabel} envoye pour commande ${order.orderNumber}`);
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
