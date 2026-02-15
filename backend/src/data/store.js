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

    updateProductStock: async (id, quantity, size = null) => {
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

        // Stock par taille si applicable
        if (size && foundProduct.sizeStock) {
            const currentSizeStock = foundProduct.sizeStock[size] || 0;
            const newSizeStock = currentSizeStock - quantity;
            await productsRef.child(foundKey).child('sizeStock').child(size).set(newSizeStock);
            // Aussi mettre a jour le stock global
            const newStock = (foundProduct.stock || 0) - quantity;
            await productsRef.child(foundKey).update({ stock: newStock });
            foundProduct.sizeStock[size] = newSizeStock;
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

    updateOrderTracking: async (id, trackingNumber) => {
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
    }
};
