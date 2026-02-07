// COVE - Shopping Cart System

// Initialize cart from localStorage
let cart = JSON.parse(localStorage.getItem('coveCart')) || [];

// Update cart count in header
function updateCartCount() {
    const countElements = document.querySelectorAll('#cart-count');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    countElements.forEach(el => {
        el.textContent = totalItems;
    });
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('coveCart', JSON.stringify(cart));
    updateCartCount();
}

// Add item to cart (with stock check)
async function addToCart(id, name, price, image) {
    const isEN = window.location.pathname.includes('/en/');
    try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        if (data.success && data.product && data.product.stock <= 0) {
            showNotification(isEN ? 'Out of stock!' : 'Rupture de stock !');
            return;
        }
        const existingItem = cart.find(item => item.id === id);
        const currentQty = existingItem ? existingItem.quantity : 0;
        if (data.success && data.product && currentQty >= data.product.stock) {
            showNotification(isEN ? 'Not enough stock!' : 'Stock insuffisant !');
            return;
        }
    } catch (e) {
        // API indisponible, on laisse ajouter
    }

    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            image: image,
            quantity: 1
        });
    }

    saveCart();
    showNotification('Ajoute au panier !');
}

// Remove item from cart
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    if (typeof renderCart === 'function') {
        renderCart();
    }
}

// Update item quantity
function updateQuantity(id, change) {
    const item = cart.find(item => item.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(id);
        } else {
            saveCart();
            if (typeof renderCart === 'function') {
                renderCart();
            }
        }
    }
}

// Get cart total
function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Show notification
function showNotification(message) {
    // Remove existing notification
    const existing = document.querySelector('.cart-notification');
    if (existing) existing.remove();

    // Create notification
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 2 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Clear cart
function clearCart() {
    cart = [];
    saveCart();
    if (typeof renderCart === 'function') {
        renderCart();
    }
}

// Check stock and update UI for out-of-stock products
async function checkStock() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (!data.success) return;

        const isEN = window.location.pathname.includes('/en/');
        const outOfStockLabel = isEN ? 'Out of stock' : 'Rupture de stock';
        const addToCartLabel = isEN ? 'Add to cart' : 'Ajouter au panier';

        data.products.forEach(product => {
            // Shop page cards
            const card = document.querySelector(`.shop-card[data-id="${product.id}"]`);
            if (card) {
                const btn = card.querySelector('.btn-add-cart');
                const overlay = card.querySelector('.shop-card-overlay');
                if (product.stock <= 0) {
                    card.classList.add('out-of-stock');
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = outOfStockLabel;
                    }
                    if (overlay) {
                        let badge = overlay.querySelector('.stock-badge');
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'stock-badge';
                            badge.textContent = outOfStockLabel;
                            overlay.prepend(badge);
                        }
                    }
                } else {
                    card.classList.remove('out-of-stock');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = addToCartLabel;
                    }
                }
            }

            // Product detail pages
            const addBtn = document.querySelector('.btn-add-to-cart');
            if (addBtn) {
                const pageProductId = getProductIdFromPage();
                if (pageProductId === product.id && product.stock <= 0) {
                    addBtn.disabled = true;
                    addBtn.textContent = outOfStockLabel;
                    addBtn.classList.add('disabled');
                }
            }
        });
    } catch (e) {
        // API indisponible
    }
}

// Get product ID from current product page
function getProductIdFromPage() {
    const btn = document.querySelector('.btn-add-to-cart');
    if (!btn) return null;
    const onclick = btn.getAttribute('onclick');
    if (!onclick) return null;
    const match = onclick.match(/addToCart\((\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    checkStock();
});
