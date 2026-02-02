const { db } = require('../config/firebase');

const productsRef = db.ref('products');
const ordersRef = db.ref('orders');
const counterRef = db.ref('orderCounter');
const usersRef = db.ref('users');

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

    updateProductStock: async (id, quantity) => {
        const snapshot = await productsRef.once('value');
        const data = snapshot.val();
        if (!data) return null;
        const products = Array.isArray(data) ? data : Object.values(data);
        const index = products.findIndex(p => p && p.id === parseInt(id));
        if (index === -1) return null;
        products[index].stock -= quantity;
        await productsRef.child(String(index)).update({ stock: products[index].stock });
        return products[index];
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

    createOrder: async (orderData) => {
        const newCounter = await counterRef.transaction(current => (current || 1000) + 1);
        const counterVal = newCounter.snapshot.val();

        const order = {
            id: counterVal,
            orderNumber: `COVE-${counterVal}`,
            ...orderData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await ordersRef.push(order);
        return order;
    },

    updateOrderStatus: async (id, status) => {
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
            status,
            updatedAt: new Date().toISOString()
        };
        await ordersRef.child(foundKey).update(updates);
        return { ...foundOrder, ...updates };
    },

    // Users
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
    }
};
