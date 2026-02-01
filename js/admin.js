var statusLabels = {
    pending: 'En attente',
    paid: 'Paye',
    processing: 'En cours',
    shipped: 'Expedie',
    delivered: 'Livre',
    cancelled: 'Annule'
};

var statusColors = {
    pending: '#f59e0b',
    paid: '#10b981',
    processing: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#22c55e',
    cancelled: '#ef4444'
};

// Detect language
var isEnglish = window.location.pathname.indexOf('/en/') !== -1;

if (isEnglish) {
    statusLabels = {
        pending: 'Pending',
        paid: 'Paid',
        processing: 'Processing',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
    };
}

// Firebase real-time listener (works if DB rules allow public reads)
var firebaseReady = false;
try {
    var firebaseConfig = {
        apiKey: 'AIzaSyAGqw2V9apHeUk2Q-DxdSFYdq6P0MbiTVM',
        databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app',
        projectId: 'covestudio'
    };
    firebase.initializeApp(firebaseConfig);
    var database = firebase.database();

    database.ref('orders').on('value', function(snapshot) {
        firebaseReady = true;
        var data = snapshot.val();
        var orders = [];
        if (data) {
            Object.keys(data).forEach(function(key) {
                orders.push(Object.assign({}, data[key], { _key: key }));
            });
        }
        orders.sort(function(a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        renderStats(orders);
        renderClients(orders);
    }, function() {
        // Firebase read denied — fallback to polling
        firebaseReady = false;
        startPolling();
    });
} catch (e) {
    startPolling();
}

// Polling fallback via backend API (every 3s)
var pollingInterval = null;

function startPolling() {
    if (pollingInterval) return;
    fetchOrders();
    pollingInterval = setInterval(fetchOrders, 3000);
}

function fetchOrders() {
    fetch('/api/admin/orders')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data.success) return;
            var orders = data.orders || [];
            orders.sort(function(a, b) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            renderStats(orders);
            renderClients(orders);
        })
        .catch(function() {});
}

// If Firebase hasn't responded after 4s, start polling as fallback
setTimeout(function() {
    if (!firebaseReady) {
        startPolling();
    }
}, 4000);

function renderStats(orders) {
    var totalOrders = orders.length;
    var totalRevenue = orders.reduce(function(sum, o) { return sum + (o.total || 0); }, 0);
    var clientEmails = {};
    orders.forEach(function(o) {
        if (o.customer && o.customer.email) {
            clientEmails[o.customer.email] = true;
        }
    });
    var totalClients = Object.keys(clientEmails).length;

    document.getElementById('stat-total-orders').textContent = totalOrders;
    document.getElementById('stat-total-revenue').textContent = totalRevenue.toFixed(2) + ' EUR';
    document.getElementById('stat-total-clients').textContent = totalClients;
}

function renderClients(orders) {
    var container = document.getElementById('admin-clients');

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted);">' +
            (isEnglish ? 'No orders yet.' : 'Aucune commande pour le moment.') + '</p>';
        return;
    }

    // Group orders by client email
    var clients = {};
    orders.forEach(function(order) {
        var email = (order.customer && order.customer.email) || 'unknown';
        if (!clients[email]) {
            clients[email] = {
                name: (order.customer.firstName || '') + ' ' + (order.customer.lastName || ''),
                email: email,
                orders: []
            };
        }
        clients[email].orders.push(order);
    });

    var html = '';

    Object.keys(clients).forEach(function(email) {
        var client = clients[email];
        html += '<div class="client-card">';
        html += '<div class="client-header">';
        html += '<div class="client-name">' + escapeHtml(client.name) + '</div>';
        html += '<div class="client-email">' + escapeHtml(client.email) + '</div>';
        html += '</div>';
        html += '<div class="client-orders">';

        client.orders.forEach(function(order) {
            var date = order.createdAt ? new Date(order.createdAt).toLocaleDateString(isEnglish ? 'en-GB' : 'fr-FR') : '-';
            var statusLabel = statusLabels[order.status] || order.status;
            var statusColor = statusColors[order.status] || '#888';

            html += '<div class="order-row">';
            html += '<div class="order-info">';
            html += '<span class="order-number">' + escapeHtml(order.orderNumber || '-') + '</span>';
            html += '<span class="order-date">' + date + '</span>';
            html += '<span class="order-total">' + (order.total ? order.total.toFixed(2) : '0') + ' EUR</span>';
            html += '</div>';
            html += '<div class="order-actions">';
            html += '<span class="status-badge" style="background:' + statusColor + ';">' + statusLabel + '</span>';
            html += '<select class="status-select" data-order-id="' + order.id + '" onchange="changeStatus(this)">';

            var allStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
            allStatuses.forEach(function(s) {
                var selected = s === order.status ? ' selected' : '';
                html += '<option value="' + s + '"' + selected + '>' + (statusLabels[s] || s) + '</option>';
            });

            html += '</select>';
            html += '</div>';

            // Order items
            if (order.items && order.items.length > 0) {
                html += '<div class="order-items">';
                order.items.forEach(function(item) {
                    html += '<span class="order-item-pill">' + escapeHtml(item.name) + ' x' + item.quantity + '</span>';
                });
                html += '</div>';
            }

            html += '</div>';
        });

        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

function changeStatus(selectEl) {
    var orderId = selectEl.getAttribute('data-order-id');
    var newStatus = selectEl.value;

    fetch('/api/admin/orders/' + orderId + '/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data.success) {
            alert(isEnglish ? 'Error updating status' : 'Erreur lors de la mise a jour du statut');
        }
    })
    .catch(function() {
        alert(isEnglish ? 'Network error' : 'Erreur reseau');
    });
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
