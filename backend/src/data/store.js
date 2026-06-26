const { db } = require('../config/firebase');

const productsRef = db.ref('products');
const ordersRef = db.ref('orders');
const counterRef = db.ref('orderCounter');
const productCounterRef = db.ref('productCounter');
const usersRef = db.ref('users');
const contactMessagesRef = db.ref('contactMessages');
const contactCounterRef = db.ref('contactCounter');
const promoCodesRef = db.ref('promoCodes');
const promoCounterRef = db.ref('promoCounter');
const waitlistRef = db.ref('waitlist');

module.exports = {
    // Products
    getProducts: async () => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
    },

    getProductById: async (id) => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return null;
        const products = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
        return products.find(p => p.id === parseInt(id)) || null;
    },

    getProductsByCategory: async (category) => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        const products = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
        return products.filter(p => p.category === category);
    },

    updateProductStock: async (id, quantity, size = null, color = null) => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundProduct = null;

        if (Array.isArray(data)) {
            const index = data.findIndex(p => p && p.id === parseInt(id));
            if (index === -1) return null;
            foundKey = String(index);
            foundProduct = data[index];
        } else {
            for (const [key, val] of Object.entries(data)) {
                if (val && val.id === parseInt(id)) {
                    foundKey = key;
                    foundProduct = val;
                    break;
                }
            }
        }

        if (!foundKey) return null;

        const ss = foundProduct.sizeStock;

        // Stock par couleur x taille (nouvelle structure : sizeStock[couleur][taille])
        if (color && size && ss && ss[color] && typeof ss[color] === 'object') {
            const newSizeStock = (ss[color][size] || 0) - quantity;
            await productsRef.child(foundKey).child('sizeStock').child(color).child(size).set(newSizeStock);
            const newStock = (foundProduct.stock || 0) - quantity;
            await productsRef.child(foundKey).update({ stock: newStock });
            ss[color][size] = newSizeStock;
            foundProduct.stock = newStock;
        // Stock par taille (ancienne structure plate : sizeStock[taille])
        } else if (size && ss && typeof ss[size] === 'number') {
            const newSizeStock = ss[size] - quantity;
            await productsRef.child(foundKey).child('sizeStock').child(size).set(newSizeStock);
            const newStock = (foundProduct.stock || 0) - quantity;
            await productsRef.child(foundKey).update({ stock: newStock });
            ss[size] = newSizeStock;
            foundProduct.stock = newStock;
        } else {
            foundProduct.stock -= quantity;
            await productsRef.child(foundKey).update({ stock: foundProduct.stock });
        }

        return foundProduct;
    },

    // Orders
    getOrders: async () => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
    },

    getOrderById: async (id) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return null;
        const orders = Object.values(data);
        return orders.find(o => o.id === parseInt(id)) || null;
    },

    getOrderByNumber: async (orderNumber) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return null;
        const orders = Object.values(data);
        return orders.find(o => o.orderNumber === orderNumber) || null;
    },

    getOrdersByEmail: async (email) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        const orders = Object.values(data);
        return orders.filter(o => o.customer && o.customer.email === email);
    },

    getOrdersByUserId: async (userId) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        const orders = Object.values(data);
        return orders.filter(o => o.userId === userId).sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    },

    createOrder: async (orderData) => {
        const newCounter = await counterRef.transaction(current => (current || 1000) + 1);
        const counterVal = newCounter.snapshot.val();

        const order = {
            id: counterVal,
            orderNumber: `COVE-${counterVal}`,
            ...orderData,
            status: 'pending',
            statusHistory: [{
                status: 'pending',
                date: new Date().toISOString(),
                comment: 'Commande créée'
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await ordersRef.push(order);
        return order;
    },

    updateOrderStatus: async (id, status, comment = '') => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundOrder = null;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) {
                foundKey = key;
                foundOrder = val;
                break;
            }
        }

        if (!foundKey) return null;

        const statusLabels = {
            pending: 'En attente',
            confirmed: 'Confirmée',
            processing: 'En préparation',
            label_printed: 'Bordereau imprimé',
            shipped: 'Expédiée',
            delivered: 'Livrée',
            cancelled: 'Annulée'
        };

        const statusHistory = foundOrder.statusHistory || [];
        statusHistory.push({
            status,
            date: new Date().toISOString(),
            comment: comment || statusLabels[status] || status
        });

        const updates = {
            status,
            statusHistory,
            updatedAt: new Date().toISOString()
        };
        await ordersRef.child(foundKey).update(updates);
        return { ...foundOrder, ...updates };
    },

    updateOrderTracking: async (id, trackingNumber, labelFile) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundOrder = null;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) {
                foundKey = key;
                foundOrder = val;
                break;
            }
        }

        if (!foundKey) return null;

        const updates = {
            trackingNumber,
            updatedAt: new Date().toISOString()
        };
        if (labelFile) {
            updates.labelFile = labelFile;
        }
        await ordersRef.child(foundKey).update(updates);
        return { ...foundOrder, ...updates };
    },

    // Users
    getAllUsers: async () => {
        const snapshot = await usersRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.entries(data).map(([uid, user]) => ({
            uid,
            ...user
        }));
    },

    getUserByUid: async (uid) => {
        const snapshot = await usersRef.child(uid).once('value');
        return snapshot.val();
    },

    createUser: async (uid, userData) => {
        const user = {
            email: userData.email,
            role: userData.role || 'client',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        await usersRef.child(uid).set(user);
        return user;
    },

    updateLastLogin: async (uid) => {
        const lastLogin = new Date().toISOString();
        await usersRef.child(uid).update({ lastLogin });
        return lastLogin;
    },

    updateUser: async (uid, updates) => {
        const allowed = ['firstName', 'lastName', 'phone', 'shippingAddress'];
        const filtered = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) filtered[key] = updates[key];
        }
        filtered.updatedAt = new Date().toISOString();
        await usersRef.child(uid).update(filtered);
        const snapshot = await usersRef.child(uid).once('value');
        return snapshot.val();
    },

    // RGPD — droit a l'effacement. Anonymise les donnees personnelles de l'utilisateur
    // dans ses commandes (on conserve montants / articles / dates / numero de commande
    // pour l'obligation legale de conservation 10 ans, cf. confidentialite.html) et
    // supprime sa fiche utilisateur RTDB. Idempotent. Ne touche PAS a Firebase Auth
    // (a faire par l'appelant via admin.auth().deleteUser).
    eraseUserData: async (uid) => {
        const userSnap = await usersRef.child(uid).once('value');
        const user = userSnap.val();
        const email = user && user.email ? user.email : null;

        const ordersSnap = await ordersRef.once('value');
        const ordersData = ordersSnap.val() || {};
        let anonymized = 0;
        for (const [key, order] of Object.entries(ordersData)) {
            const belongs = order.userId === uid
                || (email && order.customer && order.customer.email === email);
            if (!belongs || order.anonymizedAt) continue;
            await ordersRef.child(key).update({
                userId: null,
                customer: { email: 'anonymise@rgpd.local', firstName: 'Anonymise', lastName: 'RGPD', phone: '' },
                shipping: {
                    address: 'Anonymise', city: '', postalCode: '',
                    country: order.shipping ? (order.shipping.country || '') : ''
                },
                anonymizedAt: new Date().toISOString()
            });
            anonymized++;
        }
        await usersRef.child(uid).remove();
        return { email, anonymizedOrders: anonymized };
    },

    updateOrderStripeSession: async (id, sessionId) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return null;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) {
                await ordersRef.child(key).update({ stripeSessionId: sessionId });
                return true;
            }
        }
        return null;
    },

    updateOrderPayment: async (id, paymentData) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundOrder = null;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) {
                foundKey = key;
                foundOrder = val;
                break;
            }
        }

        if (!foundKey) return null;

        const updates = {
            paymentIntentId: paymentData.paymentIntentId,
            status: 'paid',
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await ordersRef.child(foundKey).update(updates);
        return { ...foundOrder, ...updates };
    },

    // Applique le stock + l'usage du code promo d'une commande, UNE SEULE FOIS.
    // Idempotent (flag `inventoryApplied`) pour resister a la double notification
    // webhook + verify. Appele UNIQUEMENT apres confirmation du paiement, jamais a
    // la creation de session : un panier abandonne ne doit pas consommer le stock.
    applyOrderInventory: async (id) => {
        const snapshot = await ordersRef.once('value');
        const data = snapshot.val();
        if (!data) return false;

        let foundKey = null;
        let order = null;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) { foundKey = key; order = val; break; }
        }
        if (!foundKey || !order) return false;
        if (order.inventoryApplied) return false; // deja applique

        // Marquer d'abord pour reduire la fenetre de double-application (webhook + verify)
        await ordersRef.child(foundKey).update({ inventoryApplied: true });

        for (const item of (order.items || [])) {
            await module.exports.updateProductStock(
                item.productId, item.quantity, item.size || null, item.color || null
            );
        }
        if (order.promoCode) {
            await module.exports.incrementPromoCodeUses(order.promoCode);
        }
        return true;
    },

    // Contact Messages
    createContactMessage: async (messageData) => {
        const newCounter = await contactCounterRef.transaction(current => (current || 0) + 1);
        const counterVal = newCounter.snapshot.val();

        const message = {
            id: counterVal,
            ...messageData,
            status: 'new',
            createdAt: new Date().toISOString()
        };

        await contactMessagesRef.push(message);
        return message;
    },

    getContactMessages: async () => {
        const snapshot = await contactMessagesRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.entries(data).map(([key, val]) => ({ ...val, _key: key }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    updateContactMessageStatus: async (id, status) => {
        const snapshot = await contactMessagesRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundMessage = null;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) {
                foundKey = key;
                foundMessage = val;
                break;
            }
        }

        if (!foundKey) return null;

        const updates = {
            status,
            updatedAt: new Date().toISOString()
        };
        await contactMessagesRef.child(foundKey).update(updates);
        return { ...foundMessage, ...updates };
    },

    // Product CRUD
    createProduct: async (productData) => {
        const newCounter = await productCounterRef.transaction(current => (current || 100) + 1);
        const counterVal = newCounter.snapshot.val();

        const product = {
            id: counterVal,
            ...productData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await productsRef.child(String(counterVal)).set(product);
        return product;
    },

    updateProduct: async (id, updates) => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundProduct = null;

        if (Array.isArray(data)) {
            const index = data.findIndex(p => p && p.id === parseInt(id));
            if (index === -1) return null;
            foundKey = String(index);
            foundProduct = data[index];
        } else {
            for (const [key, val] of Object.entries(data)) {
                if (val && val.id === parseInt(id)) {
                    foundKey = key;
                    foundProduct = val;
                    break;
                }
            }
        }

        if (!foundKey) return null;

        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };
        await productsRef.child(foundKey).update(updatedData);
        return { ...foundProduct, ...updatedData };
    },

    deleteProduct: async (id) => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        let foundKey = null;
        let foundProduct = null;

        if (Array.isArray(data)) {
            const index = data.findIndex(p => p && p.id === parseInt(id));
            if (index === -1) return null;
            foundKey = String(index);
            foundProduct = data[index];
        } else {
            for (const [key, val] of Object.entries(data)) {
                if (val && val.id === parseInt(id)) {
                    foundKey = key;
                    foundProduct = val;
                    break;
                }
            }
        }

        if (!foundKey) return null;

        await productsRef.child(foundKey).remove();
        return foundProduct;
    },

    // Promo Codes
    createPromoCode: async (data) => {
        const newCounter = await promoCounterRef.transaction(current => (current || 0) + 1);
        const counterVal = newCounter.snapshot.val();

        const promoCode = {
            id: counterVal,
            code: data.code.toUpperCase(),
            type: data.type, // 'percentage' or 'fixed'
            value: data.value,
            minOrder: data.minOrder || 0,
            maxUses: data.maxUses || 0, // 0 = unlimited
            currentUses: 0,
            active: true,
            createdAt: new Date().toISOString()
        };

        await promoCodesRef.push(promoCode);
        return promoCode;
    },

    getPromoCodes: async () => {
        const snapshot = await promoCodesRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
    },

    getPromoCodeByCode: async (code) => {
        const snapshot = await promoCodesRef.once('value');
        const data = snapshot.val();
        if (!data) return null;
        for (const [key, val] of Object.entries(data)) {
            if (val.code === code.toUpperCase()) {
                return { ...val, _key: key };
            }
        }
        return null;
    },

    incrementPromoCodeUses: async (code) => {
        const snapshot = await promoCodesRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        for (const [key, val] of Object.entries(data)) {
            if (val.code === code.toUpperCase()) {
                const newUses = (val.currentUses || 0) + 1;
                await promoCodesRef.child(key).update({ currentUses: newUses });
                return { ...val, currentUses: newUses };
            }
        }
        return null;
    },

    deletePromoCode: async (id) => {
        const snapshot = await promoCodesRef.once('value');
        const data = snapshot.val();
        if (!data) return null;

        for (const [key, val] of Object.entries(data)) {
            if (val.id === parseInt(id)) {
                await promoCodesRef.child(key).remove();
                return val;
            }
        }
        return null;
    },

    // Liste d'attente (pré-lancement) — emails des clients qui veulent être
    // prévenus à l'ouverture de la boutique. Dé-doublonné par email (normalisé
    // en minuscules). Retourne { created: true } si nouvel email, { created:false,
    // already:true } si déjà inscrit.
    addWaitlistEmail: async (email) => {
        const normalized = String(email).trim().toLowerCase();
        const snapshot = await waitlistRef.once('value');
        const data = snapshot.val() || {};
        for (const val of Object.values(data)) {
            if (val && val.email === normalized) {
                return { created: false, already: true };
            }
        }
        await waitlistRef.push({
            email: normalized,
            notified: false,
            createdAt: new Date().toISOString()
        });
        return { created: true };
    },

    getWaitlist: async () => {
        const snapshot = await waitlistRef.once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.entries(data).map(([key, val]) => ({ ...val, _key: key }))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },

    markWaitlistNotified: async (key) => {
        await waitlistRef.child(key).update({
            notified: true,
            notifiedAt: new Date().toISOString()
        });
        return true;
    }
};
