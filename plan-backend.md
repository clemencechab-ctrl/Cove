# Plan Backend - COVE E-commerce

## Objectif
Creer un backend complet pour gerer les produits, commandes, utilisateurs et paiements du site COVE.

---

## Phase 1 : Configuration du projet

### Etape 1.1 : Initialiser le projet Node.js
- Creer le dossier `backend/`
- Initialiser avec `npm init`
- Installer les dependances de base :
  - `express` (serveur web)
  - `cors` (requetes cross-origin)
  - `dotenv` (variables d'environnement)
  - `nodemon` (dev server)

### Etape 1.2 : Structure des dossiers
```
backend/
├── src/
│   ├── config/         # Configuration (DB, Stripe, etc.)
│   ├── controllers/    # Logique metier
│   ├── models/         # Modeles de donnees
│   ├── routes/         # Routes API
│   ├── middleware/     # Auth, validation, etc.
│   └── utils/          # Fonctions utilitaires
├── .env                # Variables d'environnement
├── .env.example        # Template des variables
├── package.json
└── server.js           # Point d'entree
```

### Etape 1.3 : Configurer le serveur Express
- Creer `server.js` avec Express
- Configurer les middlewares (cors, json, etc.)
- Creer une route de test `/api/health`

---

## Phase 2 : Base de donnees

### Etape 2.1 : Choisir et configurer la base de donnees
- Option A : MongoDB (NoSQL, flexible)
- Option B : PostgreSQL (SQL, robuste)
- Option C : SQLite (simple, fichier local)

### Etape 2.2 : Creer les modeles de donnees

**Modele Product :**
```
- id
- name
- description
- price
- category (tops, bottoms, outerwear, accessories)
- image_url
- stock
- created_at
- updated_at
```

**Modele Order :**
```
- id
- order_number
- customer_email
- customer_name
- shipping_address
- items (array of products + quantity)
- subtotal
- shipping_cost
- total
- status (pending, paid, shipped, delivered, cancelled)
- payment_intent_id (Stripe)
- created_at
- updated_at
```

**Modele User (optionnel) :**
```
- id
- email
- password_hash
- first_name
- last_name
- role (customer, admin)
- created_at
```

### Etape 2.3 : Creer les migrations/seeds
- Script pour creer les tables
- Script pour inserer les produits initiaux

---

## Phase 3 : API Produits

### Etape 3.1 : Routes produits
- `GET /api/products` - Liste tous les produits
- `GET /api/products/:id` - Detail d'un produit
- `GET /api/products?category=tops` - Filtrer par categorie

### Etape 3.2 : Controller produits
- Implementer la logique de recuperation
- Ajouter la pagination
- Ajouter le tri (prix, date)

### Etape 3.3 : Routes admin (protegees)
- `POST /api/admin/products` - Creer un produit
- `PUT /api/admin/products/:id` - Modifier un produit
- `DELETE /api/admin/products/:id` - Supprimer un produit

---

## Phase 4 : API Commandes

### Etape 4.1 : Routes commandes
- `POST /api/orders` - Creer une commande
- `GET /api/orders/:id` - Detail d'une commande
- `GET /api/orders?email=xxx` - Commandes d'un client

### Etape 4.2 : Validation des commandes
- Verifier que les produits existent
- Verifier le stock disponible
- Calculer le total cote serveur

### Etape 4.3 : Routes admin commandes
- `GET /api/admin/orders` - Toutes les commandes
- `PUT /api/admin/orders/:id/status` - Changer le statut

---

## Phase 5 : Integration Stripe

### Etape 5.1 : Configurer Stripe
- Creer un compte Stripe
- Recuperer les cles API (test + live)
- Installer `stripe` package

### Etape 5.2 : Creer le paiement
- `POST /api/checkout/create-session` - Creer une session Stripe Checkout
- Rediriger vers la page de paiement Stripe
- Configurer les URLs de succes/echec

### Etape 5.3 : Webhooks Stripe
- `POST /api/webhooks/stripe` - Recevoir les events Stripe
- Gerer `checkout.session.completed`
- Mettre a jour le statut de la commande
- Envoyer l'email de confirmation

---

## Phase 6 : Emails

### Etape 6.1 : Configurer le service email
- Option A : Nodemailer + Gmail
- Option B : SendGrid
- Option C : Mailgun

### Etape 6.2 : Templates email
- Email de confirmation de commande
- Email de suivi d'expedition
- Email de contact (formulaire)

### Etape 6.3 : Implementer l'envoi
- Creer le service email
- Integrer dans le flow de commande

---

## Phase 7 : Authentification (optionnel)

### Etape 7.1 : Systeme d'auth
- Installer `jsonwebtoken` et `bcrypt`
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Deconnexion

### Etape 7.2 : Middleware d'authentification
- Verifier le token JWT
- Proteger les routes admin

### Etape 7.3 : Compte client
- `GET /api/account` - Infos du compte
- `PUT /api/account` - Modifier le profil
- `GET /api/account/orders` - Historique commandes

---

## Phase 8 : Connexion Frontend-Backend

### Etape 8.1 : Modifier le frontend
- Remplacer les donnees statiques par des appels API
- Charger les produits depuis `/api/products`
- Envoyer les commandes a `/api/orders`

### Etape 8.2 : Gerer le panier
- Option A : Garder en localStorage (actuel)
- Option B : Sauvegarder en base (si auth)

### Etape 8.3 : Integrer Stripe Checkout
- Remplacer le formulaire de checkout
- Rediriger vers Stripe pour le paiement
- Afficher la confirmation au retour

---

## Phase 9 : Administration

### Etape 9.1 : Dashboard admin
- Page `/admin` pour gerer le site
- Liste des commandes
- Gestion des produits
- Statistiques de vente

### Etape 9.2 : Upload d'images
- Configurer le stockage (local ou cloud)
- Option A : Stockage local
- Option B : Cloudinary
- Option C : AWS S3

---

## Phase 10 : Deploiement

### Etape 10.1 : Preparer pour la production
- Variables d'environnement production
- Securiser les endpoints
- Optimiser les performances

### Etape 10.2 : Choisir l'hebergement
- Option A : Railway (simple, gratuit pour commencer)
- Option B : Render (gratuit, bon pour Node.js)
- Option C : Vercel (serverless)
- Option D : VPS (DigitalOcean, OVH)

### Etape 10.3 : Deployer
- Configurer le CI/CD
- Deployer le backend
- Connecter le domaine

---

## Resume des fichiers a creer

### Backend
- [ ] `backend/server.js`
- [ ] `backend/src/config/database.js`
- [ ] `backend/src/config/stripe.js`
- [ ] `backend/src/models/Product.js`
- [ ] `backend/src/models/Order.js`
- [ ] `backend/src/routes/products.js`
- [ ] `backend/src/routes/orders.js`
- [ ] `backend/src/routes/checkout.js`
- [ ] `backend/src/routes/webhooks.js`
- [ ] `backend/src/controllers/productController.js`
- [ ] `backend/src/controllers/orderController.js`
- [ ] `backend/src/controllers/checkoutController.js`
- [ ] `backend/src/middleware/auth.js`
- [ ] `backend/src/utils/email.js`

### Frontend (modifications)
- [ ] `js/api.js` (nouveau - appels API)
- [ ] `js/cart.js` (modifier pour utiliser l'API)
- [ ] `cart.html` (integrer Stripe Checkout)

---

## Technologies recommandees

| Composant | Technologie | Raison |
|-----------|-------------|--------|
| Serveur | Express.js | Simple, populaire |
| Base de donnees | MongoDB | Flexible, facile |
| ORM | Mongoose | Bien integre avec MongoDB |
| Paiement | Stripe | Fiable, bien documente |
| Email | SendGrid | Gratuit jusqu'a 100/jour |
| Auth | JWT | Standard, simple |
| Hebergement | Railway | Gratuit, facile |

---

## Variables d'environnement requises

```env
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/cove

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=contact@cove.com

# Auth (optionnel)
JWT_SECRET=your-secret-key

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

## Ordre de priorite

1. **Essentiel** : Phases 1, 2, 3, 4, 5 (backend fonctionnel avec paiement)
2. **Important** : Phases 6, 8 (emails + connexion frontend)
3. **Optionnel** : Phases 7, 9 (auth + admin)
4. **Final** : Phase 10 (deploiement)
