// COVE API Client
const API_URL = 'http://localhost:3001/api';

const api = {
    // Produits
    async getProducts(category = null) {
        try {
            let url = `${API_URL}/products`;
            if (category && category !== 'all') {
                url += `?category=${category}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getProduct(id) {
        try {
            const response = await fetch(`${API_URL}/products/${id}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Commandes
    async createOrder(orderData) {
        try {
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getOrder(orderNumber) {
        try {
            const response = await fetch(`${API_URL}/orders/${orderNumber}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Checkout
    async checkout(items, customer, shipping) {
        try {
            const response = await fetch(`${API_URL}/checkout/create-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items, customer, shipping })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async verifyPayment(sessionId, orderNumber) {
        try {
            const response = await fetch(`${API_URL}/checkout/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId, orderNumber })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Contact
    async sendContact(formData) {
        try {
            const response = await fetch(`${API_URL}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Health check
    async health() {
        try {
            const response = await fetch(`${API_URL}/health`);
            const data = await response.json();
            return data;
        } catch (error) {
            return { status: 'offline', error: error.message };
        }
    }
};

// Vérifier si le backend est disponible
async function checkBackend() {
    const health = await api.health();
    if (health.status === 'ok') {
        console.log('Backend connected:', health.message);
        return true;
    } else {
        console.log('Backend offline - using local mode');
        return false;
    }
}

// Exposer globalement
window.api = api;
window.checkBackend = checkBackend;
