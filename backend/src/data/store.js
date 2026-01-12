const fs = require('fs');
const path = require('path');

// Chemin du fichier de données
const DATA_FILE = path.join(__dirname, 'database.json');

// Données par défaut
const defaultData = {
    products: [
        {
            id: 1,
            name: "T-Shirt Chat",
            description: "T-shirt oversized avec motif chat",
            price: 65,
            category: "tops",
            image: "image/t-shirt-chat-drole-2.webp",
            stock: 50
        },
        {
            id: 2,
            name: "Hoodie Essential",
            description: "Hoodie confortable en coton premium",
            price: 120,
            category: "tops",
            image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80",
            stock: 30
        },
        {
            id: 3,
            name: "Cargo Pants",
            description: "Pantalon cargo avec poches multiples",
            price: 95,
            category: "bottoms",
            image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80",
            stock: 25
        },
        {
            id: 4,
            name: "Jacket Bomber",
            description: "Veste bomber classique",
            price: 180,
            category: "outerwear",
            image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80",
            stock: 20
        },
        {
            id: 5,
            name: "Sweatshirt Logo",
            description: "Sweatshirt avec logo COVE brode",
            price: 85,
            category: "tops",
            image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80",
            stock: 40
        },
        {
            id: 6,
            name: "Cap Classic",
            description: "Casquette avec logo COVE",
            price: 35,
            category: "accessories",
            image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&q=80",
            stock: 100
        },
        {
            id: 7,
            name: "T-Shirt Basic Noir",
            description: "T-shirt basique en coton noir",
            price: 55,
            category: "tops",
            image: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&q=80",
            stock: 60
        },
        {
            id: 8,
            name: "Veste Denim",
            description: "Veste en jean vintage",
            price: 145,
            category: "outerwear",
            image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80",
            stock: 15
        }
    ],
    orders: [],
    orderCounter: 1000
};

// Charger les données
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Creating new database...');
    }
    return { ...defaultData };
}

// Sauvegarder les données
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Store en mémoire
let store = loadData();

// API du store
module.exports = {
    // Products
    getProducts: () => store.products,

    getProductById: (id) => store.products.find(p => p.id === parseInt(id)),

    getProductsByCategory: (category) =>
        store.products.filter(p => p.category === category),

    updateProductStock: (id, quantity) => {
        const product = store.products.find(p => p.id === parseInt(id));
        if (product) {
            product.stock -= quantity;
            saveData(store);
        }
        return product;
    },

    // Orders
    getOrders: () => store.orders,

    getOrderById: (id) => store.orders.find(o => o.id === id),

    getOrderByNumber: (orderNumber) =>
        store.orders.find(o => o.orderNumber === orderNumber),

    getOrdersByEmail: (email) =>
        store.orders.filter(o => o.customer.email === email),

    createOrder: (orderData) => {
        store.orderCounter++;
        const order = {
            id: store.orderCounter,
            orderNumber: `COVE-${store.orderCounter}`,
            ...orderData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        store.orders.push(order);
        saveData(store);
        return order;
    },

    updateOrderStatus: (id, status) => {
        const order = store.orders.find(o => o.id === parseInt(id));
        if (order) {
            order.status = status;
            order.updatedAt = new Date().toISOString();
            saveData(store);
        }
        return order;
    },

    updateOrderPayment: (id, paymentData) => {
        const order = store.orders.find(o => o.id === parseInt(id));
        if (order) {
            order.paymentIntentId = paymentData.paymentIntentId;
            order.status = 'paid';
            order.paidAt = new Date().toISOString();
            order.updatedAt = new Date().toISOString();
            saveData(store);
        }
        return order;
    },

    // Reset (pour les tests)
    reset: () => {
        store = { ...defaultData };
        saveData(store);
    }
};
