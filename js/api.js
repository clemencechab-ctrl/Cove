// COVE API Client
const API_URL = '/api';

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
            const token = localStorage.getItem('coveToken');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(`${API_URL}/orders/${orderNumber}`, { headers });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getMyOrders() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/orders/my-orders`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Checkout
    async checkout(items, customer, shipping, promoCode = null) {
        try {
            const token = localStorage.getItem('coveToken');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const body = { items, customer, shipping };
            if (promoCode) body.promoCode = promoCode;

            const response = await fetch(`${API_URL}/checkout/create-session`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
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

    // Promo codes
    async validatePromoCode(code, subtotal) {
        try {
            const response = await fetch(`${API_URL}/checkout/validate-promo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, subtotal })
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

    // Utilisateurs
    async register(email, password) {
        try {
            const response = await fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async forgotPassword(email) {
        try {
            const response = await fetch(`${API_URL}/users/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async login(email, password) {
        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getProfile() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
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
    },

    // Tracking
    async setOrderTracking(orderId, trackingNumber) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/orders/${orderId}/tracking`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ trackingNumber })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getTrackingStatus(orderId) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/orders/${orderId}/tracking-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Cancel/Return request
    async requestCancellation(orderId, type, reason) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/orders/${orderId}/cancel-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type, reason })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Google Auth
    async googleAuth(idToken) {
        try {
            const response = await fetch(`${API_URL}/users/google-auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idToken })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Admin - Stats
    async getAdminStats() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Admin - Clients
    async getAdminClients() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/clients`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Admin - Update order status
    async updateOrderStatus(orderId, status, comment = '') {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, comment })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Admin - Products
    async getAdminProducts() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/products`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async createProduct(productData) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateProduct(id, productData) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/products/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async deleteProduct(id) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Admin - Messages de contact
    async getAdminMessages() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async updateMessageStatus(id, status) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/messages/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Admin - Promo Codes
    async getAdminPromoCodes() {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/promo-codes`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async createPromoCode(promoData) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/promo-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(promoData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async deletePromoCode(id) {
        try {
            const token = localStorage.getItem('coveToken');
            const response = await fetch(`${API_URL}/admin/promo-codes/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
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
