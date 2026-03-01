var statusLabels = {
    pending: 'En attente',
    paid: 'Payé',
    processing: 'En cours',
    label_printed: 'Bordereau imprimé',
    shipped: 'Expédié',
    delivered: 'Livré',
    cancelled: 'Annulé'
};

var statusColors = {
    pending: '#f59e0b',
    paid: '#10b981',
    processing: '#3b82f6',
    label_printed: '#6366f1',
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
        label_printed: 'Label Printed',
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

            var allStatuses = ['pending', 'paid', 'processing', 'label_printed', 'shipped', 'delivered', 'cancelled'];
            allStatuses.forEach(function(s) {
                var selected = s === order.status ? ' selected' : '';
                html += '<option value="' + s + '"' + selected + '>' + (statusLabels[s] || s) + '</option>';
            });

            html += '</select>';
            html += '</div>';

            // Tracking + Colissimo
            html += '<div class="order-tracking" style="display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem;">';
            html += '<input type="text" class="tracking-input" id="tracking-' + order.id + '" placeholder="' + (isEnglish ? 'Tracking number' : 'N° suivi La Poste') + '" value="' + (order.trackingNumber || '') + '" />';
            html += '<button class="btn-admin-action btn-tracking" onclick="setTrackingFirebase(\'' + order.id + '\', this)">' + (isEnglish ? 'Track' : 'Suivi') + '</button>';
            html += '<button class="btn-admin-action" onclick="generateColissimoLabelFirebase(\'' + order.id + '\', this)" style="background:#6366f1; color:#fff;">Colissimo</button>';
            if (order.labelFile) {
                html += '<a href="/api/admin/labels/' + order.labelFile + '" class="btn-admin-action" style="text-decoration:none; background:#8b5cf6; color:#fff;" target="_blank">PDF</a>';
            }
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
            alert(isEnglish ? 'Error updating status' : 'Erreur lors de la mise à jour du statut');
        }
    })
    .catch(function() {
        alert(isEnglish ? 'Network error' : 'Erreur réseau');
    });
}

function setTrackingFirebase(orderId, btn) {
    var input = document.getElementById('tracking-' + orderId);
    var trackingNumber = input ? input.value.trim() : '';
    if (!trackingNumber) {
        alert(isEnglish ? 'Please enter a tracking number' : 'Veuillez entrer un numero de suivi');
        return;
    }
    btn.disabled = true;
    var token = localStorage.getItem('coveToken');
    fetch('/api/admin/orders/' + orderId + '/tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ trackingNumber: trackingNumber })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            btn.textContent = 'OK';
            setTimeout(function() { btn.textContent = isEnglish ? 'Track' : 'Suivi'; btn.disabled = false; }, 2000);
        } else {
            alert((isEnglish ? 'Error: ' : 'Erreur: ') + (data.error || ''));
            btn.disabled = false;
        }
    })
    .catch(function() {
        alert(isEnglish ? 'Network error' : 'Erreur réseau');
        btn.disabled = false;
    });
}

function generateColissimoLabelFirebase(orderId, btn) {
    if (!confirm(isEnglish ? 'Generate a Colissimo label for this order?' : 'Générer une étiquette Colissimo pour cette commande ?')) return;
    btn.disabled = true;
    btn.textContent = isEnglish ? 'Generating...' : 'Génération...';
    var token = localStorage.getItem('coveToken');

    fetch('/api/admin/orders/' + orderId + '/generate-label', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            // Telecharger le PDF
            if (data.labelUrl) {
                fetch(data.labelUrl, { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function(resp) { return resp.blob(); })
                .then(function(blob) {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = data.labelUrl.split('/').pop();
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }
            // Remplir le tracking
            var input = document.getElementById('tracking-' + orderId);
            if (input && data.trackingNumber) {
                input.value = data.trackingNumber;
            }
        } else {
            alert((isEnglish ? 'Colissimo error: ' : 'Erreur Colissimo: ') + (data.error || ''));
        }
        btn.textContent = 'Colissimo';
        btn.disabled = false;
    })
    .catch(function() {
        alert(isEnglish ? 'Network error' : 'Erreur réseau');
        btn.textContent = 'Colissimo';
        btn.disabled = false;
    });
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
