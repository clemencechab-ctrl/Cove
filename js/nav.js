// Affiche le lien Administration uniquement pour les owners
(function () {
    try {
        const user = JSON.parse(localStorage.getItem('coveUser') || 'null');
        if (user && user.role === 'owner') {
            document.querySelectorAll('.nav-admin-only').forEach(function (el) {
                el.style.display = 'inline';
            });
        }
    } catch (e) {}
})();

// Menu mobile : bouton hamburger + panneau deroulant (Compte, Panier, Contact, FAQ)
// Injecte dynamiquement sur toutes les pages qui chargent nav.js.
(function () {
    function init() {
        const nav = document.querySelector('.header .nav') || document.querySelector('.header');
        const header = document.querySelector('.header');
        if (!nav || !header || document.querySelector('.mobile-menu-toggle')) return;

        const isEn = /\/en\//.test(window.location.pathname);
        const labels = isEn
            ? { compte: 'Account', panier: 'Cart', contact: 'Contact', faq: 'FAQ', about: 'About', admin: 'Administration' }
            : { compte: 'Compte', panier: 'Panier', contact: 'Contact', faq: 'FAQ', about: 'À propos', admin: 'Administration' };

        // L'owner voit le lien Administration dans le panneau mobile
        let isOwner = false;
        try {
            const user = JSON.parse(localStorage.getItem('coveUser') || 'null');
            isOwner = !!(user && user.role === 'owner');
        } catch (e) {}

        // Icone panier cliquable (acces direct au panier sur mobile)
        const cartLink = document.createElement('a');
        cartLink.className = 'mobile-cart-link';
        cartLink.href = 'cart.html';
        cartLink.setAttribute('aria-label', labels.panier);
        cartLink.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<circle cx="9" cy="21" r="1"></circle>' +
            '<circle cx="20" cy="21" r="1"></circle>' +
            '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>' +
            '</svg>' +
            '<span class="mobile-cart-count" id="cart-count-icon">0</span>';
        nav.appendChild(cartLink);

        // Bouton hamburger
        const toggle = document.createElement('button');
        toggle.className = 'mobile-menu-toggle';
        toggle.setAttribute('aria-label', 'Menu');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<span></span><span></span><span></span>';
        nav.appendChild(toggle);

        // Panneau deroulant
        const panel = document.createElement('div');
        panel.className = 'mobile-menu-panel';
        panel.innerHTML =
            '<a href="compte.html">' + labels.compte + '</a>' +
            '<a href="cart.html">' + labels.panier + ' (<span id="cart-count-mobile">0</span>)</a>' +
            '<a href="about.html">' + labels.about + '</a>' +
            '<a href="contact.html">' + labels.contact + '</a>' +
            '<a href="faq.html">' + labels.faq + '</a>' +
            (isOwner ? '<a href="admin.html">' + labels.admin + '</a>' : '');
        header.appendChild(panel);

        function close() {
            toggle.classList.remove('open');
            panel.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        }

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            const willOpen = !panel.classList.contains('open');
            toggle.classList.toggle('open', willOpen);
            panel.classList.toggle('open', willOpen);
            toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });

        // Ferme si on clique ailleurs
        document.addEventListener('click', function (e) {
            if (!panel.contains(e.target) && !toggle.contains(e.target)) close();
        });

        // Synchronise les compteurs panier (panneau + icone) avec le compteur desktop
        function syncCount() {
            const src = document.getElementById('cart-count');
            const val = src ? src.textContent : '0';
            const dst = document.getElementById('cart-count-mobile');
            if (dst) dst.textContent = val;
            const badge = document.getElementById('cart-count-icon');
            if (badge) {
                badge.textContent = val;
                badge.style.display = (parseInt(val, 10) > 0) ? 'flex' : 'none';
            }
        }
        syncCount();
        const srcEl = document.getElementById('cart-count');
        if (srcEl && window.MutationObserver) {
            new MutationObserver(syncCount).observe(srcEl, { childList: true, characterData: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
