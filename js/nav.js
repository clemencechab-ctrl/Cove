// Affiche le lien Administration uniquement pour les owners
(function () {
    try {
        const user = JSON.parse(localStorage.getItem('coveUser') || 'null');
        if (user && user.role === 'owner') {
            document.querySelectorAll('.nav-admin-only').forEach(function (el) {
                el.style.display = '';
            });
        }
    } catch (e) {}
})();
