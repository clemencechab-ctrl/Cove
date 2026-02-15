// COVE Auth Client
const auth = {
    init() {
        const token = localStorage.getItem('coveToken');
        if (token) {
            this.showProfile();
        } else {
            this.showAuth();
        }

        // Onglets
        const tabs = document.querySelectorAll('.auth-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.dataset.tab;
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                document.getElementById(target).classList.add('active');
            });
        });

        // Formulaires
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // Forgot password
        const forgotLink = document.getElementById('forgot-password-link');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                document.getElementById('forgot-password-form').classList.add('active');
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            });
        }

        const backToLogin = document.getElementById('back-to-login');
        if (backToLogin) {
            backToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                document.getElementById('login-form').classList.add('active');
                const loginTab = document.querySelector('.auth-tab[data-tab="login-form"]');
                if (loginTab) {
                    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                    loginTab.classList.add('active');
                }
            });
        }

        const forgotForm = document.getElementById('forgot-password-form');
        if (forgotForm) {
            forgotForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }

        // Google Sign In
        const googleBtn = document.getElementById('btn-google-signin');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                this.handleGoogleSignIn();
            });
        }
    },

    showAuth() {
        const authSection = document.getElementById('auth-section');
        const profileSection = document.getElementById('profile-section');
        if (authSection) authSection.style.display = 'block';
        if (profileSection) profileSection.style.display = 'none';
    },

    async showProfile() {
        const authSection = document.getElementById('auth-section');
        const profileSection = document.getElementById('profile-section');
        if (authSection) authSection.style.display = 'none';
        if (profileSection) profileSection.style.display = 'block';

        const result = await api.getProfile();
        if (result.email) {
            document.getElementById('profile-email').textContent = result.email || '-';
            document.getElementById('profile-role').textContent = result.role || '-';
            document.getElementById('profile-created').textContent = result.createdAt ? new Date(result.createdAt).toLocaleDateString() : '-';
            document.getElementById('profile-login').textContent = result.lastLogin ? new Date(result.lastLogin).toLocaleDateString() : '-';
        } else {
            // Token invalide
            this.handleLogout();
        }
    },

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        if (!email || !password) {
            errorEl.textContent = errorEl.dataset.required || 'Veuillez remplir tous les champs.';
            return;
        }

        const result = await api.login(email, password);
        if (result.idToken) {
            localStorage.setItem('coveToken', result.idToken);
            localStorage.setItem('coveUser', JSON.stringify(result.user));
            this.showProfile();
        } else {
            errorEl.textContent = result.error || (errorEl.dataset.invalid || 'Email ou mot de passe incorrect.');
        }
    },

    async handleRegister() {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const errorEl = document.getElementById('register-error');
        errorEl.textContent = '';

        if (!email || !password || !confirm) {
            errorEl.textContent = errorEl.dataset.required || 'Veuillez remplir tous les champs.';
            return;
        }

        if (password !== confirm) {
            errorEl.textContent = errorEl.dataset.mismatch || 'Les mots de passe ne correspondent pas.';
            return;
        }

        if (password.length < 6) {
            errorEl.textContent = errorEl.dataset.short || 'Le mot de passe doit contenir au moins 6 caracteres.';
            return;
        }

        const result = await api.register(email, password);
        if (result.idToken) {
            localStorage.setItem('coveToken', result.idToken);
            localStorage.setItem('coveUser', JSON.stringify(result.user));
            this.showProfile();
        } else {
            errorEl.textContent = result.error || (errorEl.dataset.fail || 'Erreur lors de l\'inscription.');
        }
    },

    async handleForgotPassword() {
        const email = document.getElementById('forgot-email').value;
        const errorEl = document.getElementById('forgot-error');
        const successEl = document.getElementById('forgot-success');
        errorEl.textContent = '';
        successEl.textContent = '';

        if (!email) {
            errorEl.textContent = errorEl.dataset.required || 'Veuillez entrer votre email.';
            return;
        }

        const result = await api.forgotPassword(email);
        if (result.success) {
            successEl.textContent = successEl.dataset.sent || result.message || 'Un lien de reinitialisation a ete envoye a votre adresse email.';
        } else {
            errorEl.textContent = result.error || 'Une erreur est survenue.';
        }
    },

    async handleGoogleSignIn() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            const idToken = await result.user.getIdToken();

            const authResult = await api.googleAuth(idToken);
            if (authResult.user) {
                localStorage.setItem('coveToken', idToken);
                localStorage.setItem('coveUser', JSON.stringify(authResult.user));
                this.showProfile();
            } else {
                const errorEl = document.getElementById('login-error');
                if (errorEl) errorEl.textContent = authResult.error || 'Erreur de connexion Google';
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                const errorEl = document.getElementById('login-error');
                if (errorEl) errorEl.textContent = 'Erreur de connexion Google';
            }
        }
    },

    handleLogout() {
        localStorage.removeItem('coveToken');
        localStorage.removeItem('coveUser');
        this.showAuth();
    }
};

window.auth = auth;
