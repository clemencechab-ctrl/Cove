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

// Add item to cart (with stock check and size support)
async function addToCart(id, name, price, image, size) {
    const isEN = window.location.pathname.includes('/en/');
    try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        if (data.success && data.product) {
            const product = data.product;
            // Stock par taille
            if (size && product.sizeStock) {
                const sizeStk = product.sizeStock[size] || 0;
                if (sizeStk <= 0) {
                    showNotification(isEN ? 'Out of stock for this size!' : 'Rupture de stock pour cette taille !');
                    return;
                }
                const existingItem = cart.find(item => item.id === id && item.size === size);
                const currentQty = existingItem ? existingItem.quantity : 0;
                if (currentQty >= sizeStk) {
                    showNotification(isEN ? 'Not enough stock for this size!' : 'Stock insuffisant pour cette taille !');
                    return;
                }
            } else {
                // Stock global
                if (product.stock <= 0) {
                    showNotification(isEN ? 'Out of stock!' : 'Rupture de stock !');
                    return;
                }
                const existingItem = cart.find(item => item.id === id && !item.size);
                const currentQty = existingItem ? existingItem.quantity : 0;
                if (currentQty >= product.stock) {
                    showNotification(isEN ? 'Not enough stock!' : 'Stock insuffisant !');
                    return;
                }
            }
        }
    } catch (e) {
        // API indisponible, on laisse ajouter
    }

    // Chercher item existant (meme id ET meme taille)
    const existingItem = cart.find(item => item.id === id && item.size === (size || null));

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            image: image,
            size: size || null,
            quantity: 1
        });
    }

    saveCart();
    const isENMsg = window.location.pathname.includes('/en/');
    showNotification(isENMsg ? 'Added to cart!' : 'Ajoute au panier !');
}

// Remove item from cart (by id + size)
function removeFromCart(id, size) {
    cart = cart.filter(item => !(item.id === id && item.size === (size || null)));
    saveCart();
    if (typeof renderCart === 'function') {
        renderCart();
    }
}

// Update item quantity (by id + size)
async function updateQuantity(id, change, size) {
    const item = cart.find(item => item.id === id && item.size === (size || null));
    if (!item) return;

    const newQty = item.quantity + change;

    if (newQty <= 0) {
        removeFromCart(id, size);
        return;
    }

    // Verifier stock avant d'augmenter
    if (change > 0) {
        try {
            const res = await fetch(`/api/products/${id}`);
            const data = await res.json();
            if (data.success && data.product) {
                const product = data.product;
                if (size && product.sizeStock) {
                    const sizeStk = product.sizeStock[size] || 0;
                    if (newQty > sizeStk) {
                        const isEN = window.location.pathname.includes('/en/');
                        showNotification(isEN ? 'Not enough stock for this size!' : 'Stock insuffisant pour cette taille !');
                        return;
                    }
                } else if (newQty > product.stock) {
                    const isEN = window.location.pathname.includes('/en/');
                    showNotification(isEN ? 'Not enough stock!' : 'Stock insuffisant !');
                    return;
                }
            }
        } catch (e) {
            // API indisponible
        }
    }

    item.quantity = newQty;
    saveCart();
    if (typeof renderCart === 'function') {
        renderCart();
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
                // Pour les produits avec tailles, verifier si toutes les tailles sont a 0
                let totallyOutOfStock = false;
                if (product.sizeStock) {
                    totallyOutOfStock = Object.values(product.sizeStock).every(s => s <= 0);
                } else {
                    totallyOutOfStock = product.stock <= 0;
                }

                if (totallyOutOfStock) {
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
                    }
                }
            }

            // Product detail pages - verifier stock par taille pour la taille selectionnee
            const addBtn = document.querySelector('.btn-add-to-cart');
            if (addBtn) {
                const pageProductId = getProductIdFromPage();
                if (pageProductId === product.id) {
                    if (product.sizeStock) {
                        // Mettre a jour les boutons de taille
                        updateSizeButtons(product.sizeStock, isEN);
                    } else if (product.stock <= 0) {
                        addBtn.disabled = true;
                        addBtn.textContent = outOfStockLabel;
                        addBtn.classList.add('disabled');
                    }
                }
            }
        });
    } catch (e) {
        // API indisponible
    }
}

// Mettre a jour les boutons de taille selon le stock
function updateSizeButtons(sizeStock, isEN) {
    const outLabel = isEN ? 'Out of stock' : 'Rupture de stock';
    document.querySelectorAll('.size-btn').forEach(btn => {
        const size = btn.textContent.trim();
        if (sizeStock[size] !== undefined && sizeStock[size] <= 0) {
            btn.classList.add('size-unavailable');
            btn.disabled = true;
            btn.title = outLabel;
        }
    });

    // Si la taille active est en rupture, desactiver le bouton ajouter
    const activeSize = document.querySelector('.size-btn.active');
    if (activeSize && activeSize.disabled) {
        const addBtn = document.querySelector('.btn-add-to-cart');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = outLabel;
            addBtn.classList.add('disabled');
        }
    }

    // Si toutes les tailles sont en rupture
    const allOut = Object.values(sizeStock).every(s => s <= 0);
    if (allOut) {
        const addBtn = document.querySelector('.btn-add-to-cart');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = outLabel;
            addBtn.classList.add('disabled');
        }
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
