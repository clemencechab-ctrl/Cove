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

// Add item to cart
function addToCart(id, name, price, image) {
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
});
