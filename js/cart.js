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

// --- Helpers stock par couleur -------------------------------------------------
// Le sizeStock peut etre soit plat ({S:10, M:5}) soit par couleur
// ({Blanc:{S:10...}, Noir:{S:5...}}). Ces helpers gerent les deux formes.

// Retourne le sizeStock {taille: n} pour une couleur donnee.
function getSizeStockForColor(product, color) {
    if (!product || !product.sizeStock) return null;
    const ss = product.sizeStock;
    const firstVal = Object.values(ss)[0];
    // Structure plate (valeurs numeriques) : pas de notion de couleur
    if (typeof firstVal === 'number') return ss;
    // Structure par couleur
    if (color && ss[color] && typeof ss[color] === 'object') return ss[color];
    // Couleur non precisee : agreger toutes les couleurs
    return aggregateSizeStock(product);
}

// Somme des stocks par taille sur toutes les couleurs (ou plat tel quel).
function aggregateSizeStock(product) {
    if (!product || !product.sizeStock) return null;
    const ss = product.sizeStock;
    const firstVal = Object.values(ss)[0];
    if (typeof firstVal === 'number') return ss; // deja plat
    const agg = {};
    Object.values(ss).forEach(perSize => {
        Object.entries(perSize).forEach(([size, n]) => {
            agg[size] = (agg[size] || 0) + (n || 0);
        });
    });
    return agg;
}

// Le produit est-il totalement en rupture (toutes couleurs x tailles) ?
function isProductOut(product) {
    if (product.sizeStock) {
        const agg = aggregateSizeStock(product);
        return Object.values(agg).every(s => s <= 0);
    }
    return (product.stock || 0) <= 0;
}

// Add item to cart (with stock check, size + color support)
async function addToCart(id, name, price, image, size, color) {
    const isEN = window.location.pathname.includes('/en/');
    color = color || null;
    try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        if (data.success && data.product) {
            const product = data.product;
            const sizeStock = getSizeStockForColor(product, color);
            // Stock par taille (et couleur)
            if (size && sizeStock) {
                const sizeStk = sizeStock[size] || 0;
                if (sizeStk <= 0) {
                    showNotification(isEN ? 'Out of stock for this size!' : 'Rupture de stock pour cette taille !');
                    return;
                }
                const existingItem = cart.find(item => item.id === id && item.size === size && item.color === color);
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

    // Chercher item existant (meme id ET meme taille ET meme couleur)
    const existingItem = cart.find(item => item.id === id && item.size === (size || null) && item.color === color);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            image: image,
            size: size || null,
            color: color,
            quantity: 1
        });
    }

    saveCart();
    const isENMsg = window.location.pathname.includes('/en/');
    showNotification(isENMsg ? 'Added to cart!' : 'Ajoute au panier !');
}

// Remove item from cart (by id + size + color)
function removeFromCart(id, size, color) {
    color = color || null;
    cart = cart.filter(item => !(item.id === id && item.size === (size || null) && item.color === color));
    saveCart();
    if (typeof renderCart === 'function') {
        renderCart();
    }
}

// Update item quantity (by id + size + color)
async function updateQuantity(id, change, size, color) {
    color = color || null;
    const item = cart.find(item => item.id === id && item.size === (size || null) && item.color === color);
    if (!item) return;

    const newQty = item.quantity + change;

    if (newQty <= 0) {
        removeFromCart(id, size, color);
        return;
    }

    // Verifier stock avant d'augmenter
    if (change > 0) {
        try {
            const res = await fetch(`/api/products/${id}`);
            const data = await res.json();
            if (data.success && data.product) {
                const product = data.product;
                const sizeStock = getSizeStockForColor(product, color);
                if (size && sizeStock) {
                    const sizeStk = sizeStock[size] || 0;
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

        data.products.forEach(product => {
            // Shop page cards (rupture globale + tailles agregees toutes couleurs)
            const card = document.querySelector(`.shop-card[data-id="${product.id}"]`);
            if (card) {
                const btn = card.querySelector('.btn-add-cart');
                const overlay = card.querySelector('.shop-card-overlay');
                const totallyOutOfStock = isProductOut(product);

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

                // Desactiver les tailles indisponibles (stock agrege toutes couleurs)
                const aggStock = aggregateSizeStock(product);
                if (aggStock) {
                    card.querySelectorAll('.shop-size-btn').forEach(sBtn => {
                        const sz = sBtn.textContent.trim();
                        if (aggStock[sz] !== undefined && aggStock[sz] <= 0) {
                            sBtn.disabled = true;
                            sBtn.classList.add('size-unavailable');
                        } else {
                            sBtn.disabled = false;
                            sBtn.classList.remove('size-unavailable');
                        }
                    });
                }
            }

            // Product detail page - stock par taille pour la couleur selectionnee
            const addBtn = document.querySelector('.btn-add-to-cart');
            if (addBtn) {
                const pageProductId = getProductIdFromPage();
                if (pageProductId === product.id) {
                    const sizeStock = getSizeStockForColor(product, window.selectedColor);
                    if (sizeStock) {
                        updateSizeButtons(sizeStock, isEN);
                    } else if ((product.stock || 0) <= 0) {
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

// Mettre a jour les boutons de taille selon le stock (reversible : reactive d'abord)
function updateSizeButtons(sizeStock, isEN) {
    const outLabel = isEN ? 'Out of stock' : 'Rupture de stock';
    const addLabel = isEN ? 'Add to cart' : 'Ajouter au panier';

    document.querySelectorAll('.size-btn').forEach(btn => {
        const size = btn.textContent.trim();
        const stk = sizeStock && sizeStock[size] !== undefined ? sizeStock[size] : null;
        if (stk !== null && stk <= 0) {
            btn.classList.add('size-unavailable');
            btn.disabled = true;
            btn.title = outLabel;
        } else {
            btn.classList.remove('size-unavailable');
            btn.disabled = false;
            btn.title = '';
        }
    });

    const addBtn = document.querySelector('.btn-add-to-cart');
    if (!addBtn) return;

    const activeSize = document.querySelector('.size-btn.active');
    const allOut = sizeStock && Object.values(sizeStock).every(s => s <= 0);

    if ((activeSize && activeSize.disabled) || allOut) {
        addBtn.disabled = true;
        addBtn.textContent = outLabel;
        addBtn.classList.add('disabled');
    } else {
        addBtn.disabled = false;
        addBtn.textContent = addLabel;
        addBtn.classList.remove('disabled');
    }
}

// Get product ID from current product page
function getProductIdFromPage() {
    const btn = document.querySelector('.btn-add-to-cart');
    if (!btn) return null;
    const onclick = btn.getAttribute('onclick');
    if (!onclick) return null;
    const match = onclick.match(/handleAddToCart\((\d+)/) || onclick.match(/addToCart\((\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    checkStock();
});
