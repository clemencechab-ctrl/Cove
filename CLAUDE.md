# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

COVE is a French streetwear e-commerce site. Static HTML frontend served by an Express backend, Firebase RTDB for data, Stripe for payments, Playwright for E2E tests.

## Commands

### Backend
```bash
cd backend && npm install       # Install dependencies
cd backend && npm run dev       # Start dev server (nodemon, port 3000)
cd backend && npm start         # Start production server
```

### Tests (Playwright E2E)
```bash
npm test                        # Run all tests (requires backend on port 3000)
npm run test:headed             # Run tests with browser visible
npm run test:report             # View HTML test report
npx playwright test tests/navigation.spec.js   # Run a single test file
npx playwright test -g "Page d'accueil"         # Run a single test by name
```

### Local static server (without backend)
```bash
npx http-server -p 8080 -c-1   # Serve static files, no cache
```

## Architecture

```
├── *.html                    # Frontend pages (FR), served as static files
├── en/*.html                 # English version (duplicated HTML)
├── css/style.css             # Single stylesheet
├── js/
│   ├── api.js                # API client (API_URL = '/api', all fetch calls)
│   ├── cart.js               # Cart logic (localStorage key: coveCart)
│   ├── auth.js               # Auth logic (localStorage: coveToken, coveUser)
│   ├── admin.js              # ⚠ CODE MORT — n'est chargé par AUCUNE page. Le rendu admin (renderOrders/renderClients) est INLINE dans admin.html + en/admin.html. Ne pas éditer js/admin.js en pensant changer l'admin.
│   └── firebase-config.js    # Firebase client SDK config (Google Auth only)
├── image/                    # Product and lookbook images (use hyphens, no spaces)
├── backend/
│   ├── server.js             # Express entry point, serves static files from parent dir
│   └── src/
│       ├── config/firebase.js    # Firebase Admin SDK init
│       ├── data/store.js         # All RTDB operations (products, orders, users, promos, contacts)
│       ├── middleware/auth.js    # authenticate + requireRole('owner') middleware
│       ├── routes/              # Express routers (products, orders, checkout, users, admin, contact, webhooks)
│       └── utils/email.js       # Nodemailer for order confirmations
├── tests/                    # Playwright E2E tests
│   ├── global-setup.js       # Creates test accounts via API before tests
│   ├── navigation.spec.js
│   ├── checkout.spec.js
│   ├── auth-admin.spec.js
│   └── forgot-password.spec.js
└── playwright.config.js      # baseURL: localhost:3000, chromium, slowMo:1500
```

## Key Patterns

- **Frontend-Backend communication:** All API calls go through `js/api.js` using relative path `/api`. The Express server serves both the static HTML and the API.
- **Authentication:** Firebase Auth (email/password + Google OAuth). Backend verifies JWT via `admin.auth().verifyIdToken()`. Roles stored in RTDB at `/users/{uid}/role` (`client` or `owner`). **Login Google = `signInWithPopup`** (`js/auth.js` `handleGoogleSignIn`). Symptôme courant **« aucun popup ne s'ouvre »** (surtout sur localhost, où le popup vise un autre domaine `covestudio.firebaseapp.com`) = le navigateur **bloque le popup** → Firebase renvoie `auth/popup-blocked`. Ce **n'est pas** un défaut de config : `localhost` EST dans les domaines autorisés Firebase Auth (`["localhost","covestudio.firebaseapp.com","covestudio.web.app","covestudio.fr"]`, vérifiable via l'API `identitytoolkit.googleapis.com/admin/v2/projects/covestudio/config` avec un token du service account), et la CSP autorise déjà `apis.google.com`. **Repli en place (2026-06-30)** : le `catch` de `handleGoogleSignIn` bascule sur `signInWithRedirect` quand `error.code === 'auth/popup-blocked'` (ou `operation-not-supported-in-this-environment`) ; `handleGoogleRedirectResult()` (appelé à l'init, ligne ~13) finalise la connexion au retour. Workaround utilisateur sans déploiement : autoriser les popups pour le site dans le navigateur.
- **Cart:** Entirely client-side in localStorage (`coveCart` key). No server-side cart.
- **Mode de réception (livraison / remise en main propre) :** au checkout (`cart.html` + `en/cart.html`), l'acheteur choisit entre **livraison à domicile** (5,90 EUR, offerte ≥100 EUR) et **remise en main propre** (gratuite). La remise en main propre est protégée par un **code** (défaut `15221267`, surcharge via env `PICKUP_CODE`). Le code est vérifié **deux fois** : (1) côté client (`validatePickupCode()` débloque le bouton payer, masque/rend non-requis les champs adresse) — pur confort UX, contournable ; (2) côté serveur dans `checkout.js` (`POST /create-session`) qui renvoie **403** si `deliveryMethod==='pickup'` et `pickupCode` ≠ `PICKUP_CODE`, **avant** toute écriture en base — c'est le vrai garde-fou contre le contournement des frais de port. `deliveryMethod` (`'delivery'`/`'pickup'`) est stocké sur la commande, affiché dans les emails (`email.js` : bannière « ⚠ REMISE EN MAIN PROPRE — ne pas expédier » côté owner) et dans l'historique `compte.html`. **Le code `15221267` est dupliqué à 3 endroits** : `cart.html` + `en/cart.html` (`validatePickupCode`) et le fallback serveur (`checkout.js`) — changer le code = mettre à jour les 3 (ou définir `PICKUP_CODE` + les 2 HTML).
- **Products:** Currently 2 products, both t-shirts at 30 EUR: id:1 "Covestudio" (`produit-tshirt.html`) and id:2 "Grandir sans bruit" (`produit-hoodie.html` — the file is still named *hoodie* for historical reasons but now holds the second tee, NOT a hoodie). Both `category: tops`, et déclinés en 2 couleurs (`colors: ["Blanc","Noir"]`). **Stock par taille ET par couleur** : `sizeStock` est **imbriqué** `{Blanc: {XS,S,M,L,XL}, Noir: {XS,S,M,L,XL}}` (le store `updateProductStock(id, qty, size, color)` décrémente `sizeStock[color][size]` ; un format plat `{XS..XL}` reste géré en fallback pour un produit sans couleurs). L'admin (`admin.html` + `en/admin.html`) affiche **une ligne par design×couleur (donc 4 lignes)** et le modal d'édition a **une grille de tailles par couleur** (`renderSizeStockGrids`/`collectSizeStock`, qui recalcule aussi le total `stock`). Migration flat→imbriqué : `node tests/migrate-sizestock-by-color.js [--dry]` (idempotent). **Le stock EST appliqué côté boutique** : `js/cart.js` définit `checkStock()` (appelé au chargement via `DOMContentLoaded` et à chaque `selectColor` sur les pages produit) — il grise (`.size-unavailable`, opacity 0.3 + barré) les tailles à 0 **pour la couleur sélectionnée**, bloque « Ajouter au panier » (→ « Rupture de stock »), désactive les cartes boutique totalement épuisées, et `addToCart`/`updateQuantity` refusent de dépasser le stock dispo. Helpers `getSizeStockForColor`/`aggregateSizeStock` gèrent imbriqué ET plat. **Garde-fou serveur** : `checkout.js` (`create-session`) recalcule le stock dispo (`getAvailableStock`, même logique) et renvoie **409** « Stock insuffisant pour … (reste N) » avant toute écriture si `quantity > dispo`. The charged price comes from RTDB `product.price` (the backend recomputes the cart in `checkout.js`, ignoring the client-sent price); the displayed/cart price is hardcoded in the HTML (`data-price`, `.product-price`, `.shop-card-price`, and the `handleAddToCart(...)` arg). To change a price coherently, update **both** RTDB and the HTML. To temporarily lower prices for a real-payment test, use `node tests/set-product-prices.js test|restore` (RTDB only).
- **Photos produit — galerie PILOTÉE PAR L'ADMIN (2026-07-01).** Contrairement au prix (codé en dur), **les photos des fiches produit sont désormais data-driven** depuis RTDB `product.images`. Structure : `images[couleur] = { main: <url>, thumbnails: [<url>, ...] }` (la 1re de `thumbnails` = principale ; `main` = `thumbnails[0]`). Les uploads passent par `POST /api/admin/upload` → URL absolue `https://storage.googleapis.com/covestudio-uploads/...`. **Flux d'affichage** : chaque page produit (`produit-tshirt.html` id:1, `produit-hoodie.html` id:2, + `en/`) garde un `COLOR_IMAGES` **de repli** codé en dur, puis `loadProductImages()` (au `DOMContentLoaded`) fetch `/api/products/:id` et **écrase** `COLOR_IMAGES` avec `images` de la base, puis `renderThumbnails(selectedColor)`. Si le fetch échoue → repli conservé (rien ne casse). ⚠️ Sur les pages EN (servies sous `/en/`), `resolveImgSrc()` **préfixe `../`** les chemins **relatifs** `image/...` ; les URLs absolues (uploads admin) sont laissées telles quelles — donc les vrais uploads marchent en FR **et** EN, seuls les anciens placeholders relatifs en base auraient besoin du préfixe. **Édition dans l'admin** : le modal produit (`admin.html` + `en/admin.html`) a un **gestionnaire de galerie multi-photos par couleur** (`#product-gallery-container`, fonctions `initGalleryState`/`renderGalleryManager`/`galleryUpload`/`gallerySetMain`/`galleryRemove`/`collectGallery`) — une galerie par couleur de `product.colors`, upload multiple, ★ = principale (réordonne en tête), × = retirer. `saveProduct` envoie `images` (par couleur) **et** `image` (1re photo, pour la vignette du tableau admin legacy) ; le backend (`routes/admin.js` POST+PUT) **whiteliste maintenant `images` et `colors`** (ajouté 2026-07-01 — avant, ces champs étaient silencieusement ignorés). `store.updateProduct` fait `.update({images})` qui remplace le nœud `images` entier (donc retrait de photo = bien persisté). Produit **sans** `colors` → clé spéciale `'default'`, seule la 1re photo est conservée (`image` legacy), le multi n'est pas stocké (aucune page produit colorless câblée). **Pour changer les photos : passer par l'admin** (plus besoin d'éditer le HTML). `js/admin.js` reste du code mort non chargé.
- **Cartes produit ACCUEIL + BOUTIQUE aussi data-driven (2026-07-01).** `index.html`, `shop.html` + `en/` : les `.shop-card[data-id]` avaient leurs `<img src>` et `data-image-blanc`/`data-image-noir` codés en dur. Désormais `loadCardImages()` (au `DOMContentLoaded`) fetch `/api/products` et **réécrit** `data-image-blanc`/`data-image-noir`/`data-image` + le `<img>.src` de chaque carte depuis `product.images[couleur].main`. Donc **ajouter une photo dans l'admin met à jour l'accueil ET la boutique** (plus le HTML codé en dur qui ne sert que de repli avant le fetch). Même règle `resolveCardImg()` que les pages produit : EN préfixe `../` les chemins relatifs `image/...`, absolus intacts. Le swap de couleur (`shopSelectColor`) et l'ajout panier lisent ces `data-image-*` réécrits.
- **Photos réelles en place (2026-07-01)** : les 2 tees ont chacun **front (principale) + back**, en Blanc et Noir. Fichiers dans `image/` (tirets, pas d'espaces) : `front|back-covestudio-{blanc,noir}.{jpeg,png}` (produit 1) et `front|back-gsb-{blanc,noir}.{jpeg,png}` (produit 2 « Grandir sans bruit », alias **gsb**). Références en base RTDB `product.images` en chemins **relatifs** `image/...` (servis par Hosting ET Cloud Run). Pour remplacer une photo : soit passer par l'admin (upload → URL GCS absolue), soit déposer le fichier dans `image/` + mettre à jour `product.images` en RTDB.
- **Admin:** Protected by `requireRole('owner')` middleware. **Le JS de la page admin est entièrement INLINE dans `admin.html` (FR) et `en/admin.html` (EN)** — `admin.html` charge `cart.js`, `api.js`, `nav.js` mais **PAS `js/admin.js`** (ce dernier est du code mort, non référencé). Données via `/api/admin/clients` (onglet Clients = comptes) et `/api/admin/orders` (onglet Commandes = toutes les commandes, invités inclus). Chaque commande affiche : bandeau mode de réception (`order.deliveryMethod` : bleu « Envoi La Poste » / orange « Remise en main propre »), bloc « Coordonnées client » (nom/email/téléphone + adresse `order.shipping` pour livraison, sinon note « ne pas expédier »), et articles avec couleur+taille (`order.items[].color/size`). Helper `esc()` (FR) / `escHtml()` (EN) échappe toute donnée client (anti-XSS stocké via le checkout public). Pour modifier l'affichage des commandes, éditer les **deux** fichiers HTML.
- **`GET /api/admin/stats` — `totalRevenue` (2026-07-05, corrigé) :** un statut de commande n'est PAS un simple booléen payé/pas-payé — après paiement, `status` continue d'avancer (`paid` → `confirmed` → `processing` → `label_printed` → `shipped` → `delivered`, cf. `validStatuses` dans `routes/admin.js`/`routes/orders.js`). Un premier bug sommait `total` de **toutes** les commandes y compris `pending`/`cancelled` (jamais payées) → CA gonflé (corrigé commit `fc31734`). Le correctif introduisait un second bug : filtrer strictement `status === 'paid'` **excluait** les commandes déjà avancées dans le suivi (`delivered` etc.), alors qu'elles ont bien été payées → CA sous-évalué dès qu'une commande est expédiée/livrée. **Fix actuel (`backend/src/routes/admin.js` ligne ~74) : filtrer sur `o.paidAt` (posé une seule fois par `store.updateOrderPayment`, jamais retiré) et exclure `status === 'cancelled'`**, plutôt que de lister les statuts "payés" à la main. Si une nouvelle valeur de statut de suivi est ajoutée un jour, ce filtre n'a pas besoin d'être mis à jour.
- **i18n:** No framework, just duplicated HTML files in `/en/` with `../` prefixed paths for assets.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | No | Health check |
| GET | /api/products | No | List products |
| GET | /api/products/:id | No | Product detail |
| POST | /api/users/register | No | Create account |
| POST | /api/users/login | No | Login |
| POST | /api/users/google-auth | No | Google OAuth |
| POST | /api/users/forgot-password | No | Password reset |
| GET | /api/users/me | Bearer | User profile |
| POST | /api/checkout/create-session | No | Stripe checkout |
| POST | /api/checkout/validate-promo | No | Validate promo code |
| POST | /api/contact | No | Contact form |
| POST | /api/waitlist | No | Inscription liste d'attente (pré-lancement) |
| GET | /api/waitlist | Owner | Liste des inscrits liste d'attente |
| POST | /api/orders | No | Create order |
| GET | /api/orders/:orderNumber | Bearer | Order details |
| GET | /api/orders/my-orders | Bearer | User's orders |
| GET | /api/admin/stats | Owner | Dashboard stats |
| GET | /api/admin/clients | Owner | Client list |
| PUT | /api/admin/orders/:id/status | Owner | Update order status |
| PUT | /api/admin/orders/:id/tracking | Owner | Set tracking number |
| ALL | /api/admin/products | Owner | Product CRUD |
| ALL | /api/admin/promo-codes | Owner | Promo code CRUD |
| GET | /api/admin/messages | Owner | Contact messages |
| POST | /api/webhooks/stripe | No | Stripe webhook |

## Verrou d'accès privé — LEVÉ le 01/07/2026 (site désormais public)

> **⚠ Le verrou a été RETIRÉ le 2026-07-01 (`node tests/gate.js remove`) : le site est public, accessible à tous, sans redirection vers `coming-soon.html`.** Vérifié en prod : 0 marqueur `COVE-GATE` restant, aucune page ne redirige vers `coming-soon.html`, toutes répondent 200. `coming-soon.html` existe encore sur le disque mais est **orpheline** (plus liée ni référencée) ; la route/limiter `/api/waitlist` restent en place. La section ci-dessous documente le mécanisme **au cas où il faudrait re-verrouiller** (`node tests/gate.js add`). **Reste optionnel** : (1) envoyer l'alerte de lancement aux inscrits waitlist (`node tests/notify-waitlist.js --send`) — action e-mail sortante, à faire sur demande explicite ; (2) supprimer `coming-soon.html` + la route/limiter waitlist si plus utiles.

Pendant la phase de teaser réseaux sociaux, le site était rendu **privé** : tout visiteur était redirigé vers **`coming-soon.html`** (page d'attente autonome : logo blanc, « Ouverture le 01/07/2026 », champ code d'accès, **+ formulaire d'inscription liste d'attente par email**) tant qu'il n'avait pas saisi le code. Le bon code posait `localStorage.coveAccess = 'GRANTED'` et débloquait **tout le site** (mémorisé par appareil).

- **Code d'accès actuel : `jetapinelecode12`** — défini à **un seul endroit**, la const `ACCESS_CODE` en haut du `<script>` de `coming-soon.html`. Pour le changer, éditer cette ligne uniquement.
- **Le verrou** est un petit `<script>` inline injecté avant `</head>` de **26 pages** (FR + EN), encadré par les marqueurs `COVE-GATE-START` / `COVE-GATE-END`. Il redirige vers `/coming-soon.html` si le flag n'est pas posé. **Limite assumée** : protection côté client (contournable par inspection du source) — suffisant pour empêcher les clients de commander pendant le teaser, pas une sécurité serveur.
- **Pose / retrait via `node tests/gate.js add|remove`** (idempotent, liste des pages en dur dans le script). `coming-soon.html` n'est jamais verrouillée.
- **Liste d'attente (notify au lancement)** : `coming-soon.html` poste l'email saisi vers **`POST /api/waitlist`** (public, rate-limité 15/15min, dé-doublonné par email en minuscules → RTDB `/waitlist/{pushId}` = `{email, notified, createdAt}`). Fonctions store : `addWaitlistEmail` / `getWaitlist` / `markWaitlistNotified` ([store.js](backend/src/data/store.js)). `GET /api/waitlist` (owner) liste les inscrits. **Le jour J, envoyer l'alerte** : `node tests/notify-waitlist.js` (dry-run, liste les destinataires) puis `--send` (envoie réellement via `sendDropAlert` de [email.js](backend/src/utils/email.js), idempotent via le flag `notified`, force `FRONTEND_URL=https://covestudio.fr` pour que le bouton de l'email pointe vers la prod et pas le localhost du `.env`).
- **Le jour de l'ouverture (01/07/2026)** : (1) `node tests/notify-waitlist.js --send` pour prévenir les inscrits ; (2) `node tests/gate.js remove` ; (3) redéployer ; (4) supprimer `coming-soon.html` + la route/limiter waitlist si plus utile. Retirer aussi cette section.

## Environment

- Backend env file: `backend/.env` (see `backend/.env.example` for template) — **mode TEST** (clés `sk_test`, `FRONTEND_URL=http://localhost:3000`) pour le dev local.
- `backend/.env.production` (gitignored) — **overrides LIVE** poussés sur Cloud Run par le déploiement : `STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` (webhook live), `FRONTEND_URL=https://covestudio.fr`. Ne jamais committer.
- Firebase service account JSON at project root (referenced in `backend/src/config/firebase.js`)
- Firebase project: `covestudio` (europe-west1)

## Emails transactionnels — envoi & délivrabilité

- **Envoi via Gmail SMTP** (`smtp.gmail.com:587`), compte `cove.off@gmail.com` (`EMAIL_USER`/`EMAIL_PASS`, mot de passe d'application). Donc les emails sont **DKIM-signés par Gmail** (pas un défaut d'authentification) → le problème de placement est surtout la **classification Gmail (onglet Promotions)**, pas le spam pur.
- **Client + owner reçoivent 2 emails distincts** à chaque commande payée : `sendOrderConfirmation` (→ `order.customer.email`) et `sendOrderNotificationToOwner` (→ owner). Déclenchés ensemble dans le webhook Stripe (`webhooks.js`) + fallback `/verify` (`checkout.js`, poll toutes les 4s depuis `success.html`). Log SMTP détaillé par envoi : `[SMTP] to=… accepted=[…] rejected=[…] response="250 …"`. **Un `250 OK` + `accepted` = Gmail a pris l'email en charge** : si le client « ne l'a pas reçu », c'est quasi toujours **Spam/Promotions**, pas un bug. Vérifier via les logs Cloud Run (`gcloud logging read … textPayload:"[SMTP]"`).
- **Bug corrigé (2026-07-07) — client recevait 2 emails de confirmation pour 1 seule commande visible en admin.** Cause : race entre le webhook Stripe et le fallback `/verify`. Les deux lisent `order.status` **avant** d'écrire `paid` (check-then-act non atomique) ; si le webhook arrive à quelques centaines de ms d'un poll `/verify` (fréquent : le client atterrit sur `success.html` et lance le polling juste au moment où Stripe notifie), **les deux passent le garde-fou `status !== 'paid'`**. `store.applyOrderInventory` (idempotent via le flag `inventoryApplied`) empêchait déjà la double décrémentation de stock — c'est pour ça que l'admin affichait bien 1 seul achat — **mais l'envoi des emails n'était pas conditionné à son retour**, donc les deux requêtes envoyaient chacune leurs emails. **Fix** : dans `webhooks.js` et `checkout.js` (`/verify` fallback), les emails ne partent que si `applyOrderInventory` retourne `true` (= c'est bien cette requête qui a appliqué l'inventaire, pas l'autre en concurrence).
- **Renvoyer une confirmation** : script one-off qui charge la commande (RTDB, par `orderNumber`) et appelle `sendOrderConfirmation(order)`. **Forcer `process.env.PUBLIC_URL='https://covestudio.fr'` AVANT `require('email.js')`** (le module lit `PUBLIC_URL` à l'import, ligne 6) sinon les images produit de l'email pointent ailleurs.
- **Améliorations délivrabilité en place (2026-07-01)** : (1) défaut `PUBLIC_URL` = `https://covestudio.fr` (avant : une URL GitHub Pages → images cassées) ; (2) expéditeur nommé `COVE <cove.off@gmail.com>` (`getFromAddress`) ; (3) `Reply-To` ajouté à tous les envois (`sendMail`). **Limite honnête** : on ne peut PAS garantir l'onglet « Principale » (Gmail décide). Le levier le plus fort restant = passer à un **expéditeur sur le domaine `covestudio.fr`** (Google Workspace ou provider type Resend/Postmark) avec **SPF/DKIM/DMARC** — nécessite DNS + compte, non fait. Autre levier : alléger le gros bandeau image 600px (`getEmailHeader`) qui est un signal « Promotions ».

## Stripe — moyens de paiement

- `checkout.js` utilise `payment_method_types: ['card']`. **`card` inclut Apple Pay et Google Pay automatiquement** (wallets), sans vérification de domaine car on utilise Stripe **Checkout hébergé**. Aucune clé publique côté frontend.
- **PayPal a été retiré** car il n'est **pas activé sur le compte Stripe live** (le laisser dans `payment_method_types` fait échouer TOUTE création de session en live — vérifié). Pour le réactiver : l'activer dans le Dashboard Stripe (Settings > Payment methods) en mode live, **puis** remettre `'paypal'` dans le tableau de `checkout.js`.
- Le montant débité = `product.price` en RTDB (le backend recalcule, cf. plus haut). Pour un test de paiement réel à bas prix : `node tests/set-product-prices.js test|restore` (RTDB) + baisser les prix en dur dans les 6 HTML produit (`shop.html`, `produit-*.html`, idem `en/`).

## Admin / Owner account

**The sole admin (owner) account for production is `clemence.chab@gmail.com`** (Google OAuth). This must remain the only account with `role: "owner"` in `users/{uid}/role`. Do not grant owner to any other account without explicit instruction; demote any account you accidentally promote during testing.

## Sécurité — posture vérifiée (2026-06-09)

Analyse de la PR #1 (audit Grok du 31/05, hypothétique en *worst-case*) confrontée au code/infra réels. **Vérifié en prod :**
- **Règles RTDB verrouillées** : `orders/users/contactMessages/promoCodes/products.json` renvoient tous **HTTP 401** en lecture non authentifiée. Le pire scénario de l'audit (« orders.json public ») n'existe pas. Le listener Firebase de `js/admin.js` (`database.ref('orders').on(...)`, non authentifié) est donc **toujours refusé** → bascule sur le polling `/api/admin/orders`. Pas une fuite, juste du code mort.
- **Tous les endpoints `/api/admin/*` renvoient 401 sans Bearer** — authz owner solide (`requireRole('owner')`).
- **Stripe prod déjà en live** (`.env.production` `sk_live` + webhook live). Les P0 « migration Stripe » de l'audit sont historiques. Le mode démo (`!STRIPE_SECRET_KEY`) est inerte en prod (clé définie).

**Quick wins appliqués et déployés (commit `29c7afe`) :**
- Retrait des deps mortes vulnérables `mongoose` + `sharp` de `backend/package.json` (jamais `require()` côté backend — **ne pas les réinstaller**). `npm audit` : 21 → 16 vulns, HIGH 5 → 2 (les 2 critiques + 2 hautes restantes sont transitives profondes du SDK Google/Express, non exploitables ici).
- `express-rate-limit` 8.2.1 → 8.5.2 (fix HIGH contournement IPv6).
- **Échappement HTML** de toute donnée user dans `backend/src/utils/email.js` via le helper `escapeHtml()` (surtout le formulaire de contact, attaquant-contrôlé). Les en-têtes `subject` d'email ne sont **pas** échappés en entités (géré par nodemailer).
- Rate limiter dédié `checkoutLimiter` (30/15min) sur `/api/checkout/create-session` + `/validate-promo` dans `server.js`.

**Revue pré-lancement (2026-06-15, commit `c1ed2a9`) — corrigé :**
- **IDOR `GET /api/orders/:id/tracking-status`** : ajout du contrôle d'appartenance (admin OU propriétaire). Avant, comme les `id` sont séquentiels, tout compte connecté pouvait lire le numéro de suivi + adresse de livraison de n'importe quelle commande.
- **`POST /api/orders`** était **anonyme** (`optionalAuth`) et décrémentait le stock sans paiement → DoS inventaire / spam de commandes. Désormais `authenticate + requireRole('owner')` (saisie manuelle owner) et **ne décrémente plus le stock**. Le vrai flux d'achat client reste `/api/checkout/create-session` (Stripe). Le helper mort `api.createOrder` (`js/api.js`) a été retiré ; les 2 scripts de test (`tests/admin-status-emails.js`, `tests/prod-admin-status-emails.js`) passent maintenant le token owner à cet appel.
- **Stock + usage code promo : décrémentés APRÈS paiement uniquement**, plus à la création de session. Nouvelle fonction idempotente `store.applyOrderInventory(orderId)` (flag `inventoryApplied` sur la commande) appelée dans le webhook Stripe, le fallback `/verify` et le mode démo. Un panier abandonné ne vide plus l'inventaire ni ne brûle un code promo. Le garde-fou de disponibilité (**409** à la création de session) reste. **Tradeoff connu** : le stock n'étant plus réservé entre création de session et paiement, deux acheteurs sur le dernier exemplaire peuvent tous deux payer (oversell) — acceptable pour ce volume/2 produits, et bien meilleur que le drain permanent sur abandon.

**Durcissement complémentaire (2026-06-15, 2e passe) — corrigé :**
- **CSP activée.** ⚠️ **En prod les pages HTML sont servies par Firebase Hosting, PAS par Express/Cloud Run** — la CSP de référence est donc dans **`firebase.json`** (`headers` source `**`, + `X-Content-Type-Options: nosniff`, `Referrer-Policy`). Une CSP identique est aussi posée via **helmet** dans `server.js` (couvre l'accès direct Cloud Run + l'API). **Garder les deux synchronisées.** La CSP doit tolérer `'unsafe-inline'` (front statique sans build : `<script>` inline + handlers `onclick` + `style=`) ; helmet est en `useDefaults:false` pour éviter son défaut `script-src-attr 'none'` qui casserait les `onclick`. Origines autorisées (issues du code réel) : `www.gstatic.com` (SDK Firebase), `apis.google.com` (**indispensable au login Google** — voir ci-dessous), `fonts.googleapis.com`/`fonts.gstatic.com`, `gc.zgo.at`+`covestudio.goatcounter.com` (GoatCounter), `*.googleapis.com`+RTDB host (ws/wss)+`covestudio.firebaseapp.com`+`accounts.google.com` (Firebase Auth/OAuth). **`apis.google.com` doit être dans `script-src` ET `frame-src`** : le SDK Firebase compat (v8) charge `https://apis.google.com/js/api.js` **dans la page parente** pour piloter le popup `signInWithPopup`. Sans cette origine, le script est bloqué (`violatedDirective: script-src-elem`) et la connexion Google échoue avec **`auth/internal-error`** (symptôme exact : « Erreur de connexion Google : Firebase: Error (auth/internal-error). »). Vérifié et corrigé le 2026-06-24 (l'origine manquait au moment de l'ajout initial de la CSP). **Vérifié en navigateur** (preview) : index/compte/cart/admin se chargent sans violation, Firebase SDK s'initialise sans `'unsafe-eval'`. Si tu ajoutes un script/origine externe, l'autoriser dans **les deux** endroits.
- **`error.message` masqué** sur toutes les réponses **500** des routes (`checkout/admin/orders/contact/products`) → message générique `'Erreur serveur'`, le détail est loggé côté serveur (`console.error`). Les messages 4xx de validation restent explicites (sûrs et utiles).
- **`/api/checkout/verify` ne renvoie plus `total`** (seulement `orderNumber` + `paid`/`status`) : `success.html` n'utilisait que `paid`. Pas de rate-limit ajouté car la page poll jusqu'à 30 min (le limiter casserait le flux légitime) ; retirer la donnée sensible était le bon fix.
- **RGPD — droit à l'effacement outillé.** `store.eraseUserData(uid)` anonymise les données perso dans les commandes (nom/email/tel/adresse → placeholders, flag `anonymizedAt`) en **conservant** montants/articles/dates (obligation légale 10 ans, cf. `confidentialite.html`) puis supprime la fiche RTDB. Endpoint owner `DELETE /api/admin/clients/:uid` (anonymise + supprime le compte Firebase Auth). CLI opérateur **`node tests/rgpd.js erase <email> [--apply]`** (effacement sur demande) et **`node tests/rgpd.js retention [--apply]`** (purge des clients inactifs > 3 ans, dry-run par défaut). Les durées (3 ans clients / 10 ans commandes) collent à `confidentialite.html`.

**Incident — `.git` exposé publiquement (2026-06-30) — corrigé :** le dossier `.git/` était téléchargeable sur la prod (`https://covestudio.fr/.git/HEAD|config|index` → 200). **Cause racine : `firebase.json` `hosting.ignore` n'excluait PAS `.git`** alors que `hosting.public` vaut `"."` (racine du repo). Donc tout déploiement via le **firebase CLI** (`deploy.ps1` étape 7) **ou GitHub Actions** uploadait `.git/` entier. (Le script Claude `tests/deploy-hosting.js` était déjà sûr : son `ALSO_IGNORE` hard-code `/^\.git/` + `/^\.github/` — c'est pourquoi un redeploy via ce script a nettoyé l'expo.) **Fix : ajout de `.git/**`, `**/.git/**`, `.github/**`, `**/.*`, `.gitignore`, `.gcloudignore` à `firebase.json` `ignore`** + redeploy. Vérifier après tout déploiement : `curl -s -o /dev/null -w "%{http_code}" https://covestudio.fr/.git/HEAD` doit renvoyer **404**. **Aggravant : l'URL du remote git (`.git/config`) embarquait un token `user:token`** (`git remote get-url origin` montrait `https://<creds>@github.com/...`) → exposé publiquement avec `.git/config`. **Retiré** via `git remote set-url origin https://github.com/clemencechab-ctrl/Cove.git` (auth désormais par Git Credential Manager). **Le token DOIT être révoqué sur GitHub** (Settings → Developer settings → Personal access tokens). **Ne jamais embarquer de token dans l'URL du remote.** Note : aucun fichier secret n'a jamais été commité (`.env`, `.env.production`, les JSON service account, `github-actions-sa-key.json`, `firebase-sa-b64.txt` sont tous gitignored ET 0 commit dans l'historique `--all`), donc l'historique `.git` exposé ne contenait pas les clés.

**Incident AGGRAVÉ — service accounts servis en clair par Hosting (2026-06-30) — corrigé, ROTATION REQUISE :** en vérifiant l'ensemble des chemins, `public: "."` servait aussi (HTTP 200) des fichiers **gitignored mais présents sur le disque racine**, que l'`ignore` ne couvrait pas. **Deux étaient critiques** : **`/firebase-sa-b64.txt`** (base64 du service account Firebase Admin → accès admin complet RTDB/Auth/Storage) et **`/github-actions-sa-b64.txt`** (base64 du SA GCP de déploiement `github-actions-deploy@covestudio.iam` → `run.admin`/`storage.admin`/`firebase.admin`). Les `.json` (`*-adminsdk*.json`, `github-actions-sa-key.json`) étaient déjà 404 grâce à `"*.json"`, mais **les variantes `.txt` base64 passaient à travers** (et `*.ps1`, `deploy.log` aussi). Servis depuis l'origine du site (probablement des semaines) → **les deux clés sont compromises**. **Fix `ignore` : ajout de `*.ps1`, `*.log`, `*.md`, `*-b64.txt`, `*-sa-key*`, `*adminsdk*`, `nul`/`NUL`** (garder servis : `robots.txt`, `sitemap.xml`, `BingSiteAuth.xml`, html/css/js/image). Vérif post-deploy : `curl -s -o /dev/null -w "%{http_code}" https://covestudio.fr/firebase-sa-b64.txt` doit être **404**. **À FAIRE (utilisateur + gcloud) : révoquer/recréer les 2 clés de service account** — (1) Firebase Admin : GCP IAM → SA `…adminsdk…` → Keys → supprimer l'ancienne, créer une neuve → mettre à jour le JSON racine + `firebase-sa-b64.txt` + secret GitHub `FIREBASE_SERVICE_ACCOUNT_B64` ; (2) SA déploiement : SA `github-actions-deploy` → Keys → supprimer/recréer → `github-actions-sa-key.json` + `github-actions-sa-b64.txt` + secret GitHub `GCP_SA_KEY`. **Leçon de fond : `public: "."` (racine du repo) est une approche par liste-noire fragile — tout nouveau fichier sensible déposé à la racine est servi par défaut. Idéalement, déplacer le front dans un dossier `public/` dédié.**

**Reste à traiter (non bloquant)** : labels Colissimo sur disque éphémère Cloud Run ; durcissement progressif de la CSP (retirer `'unsafe-inline'` exigerait de sortir les scripts/handlers inline du HTML). **Recommandation PR #1 : ne pas merger telle quelle** — la réécriture de `plan.md` est périmée (mentionne « T-shirt 65€/Hoodie 120€ ») ; ne garder que `SECURITY_AUDIT_CHECKLIST.md` si besoin.

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | test-user@cove-test.com | CoveTest2026! |
| Client | test-owner@cove-test.com | CoveOwner2026! (historically seeded as owner, now demoted to client) |

If a test needs an owner session, **do not** promote `test-owner@cove-test.com` — instead, mint a Firebase custom token for `clemence.chab@gmail.com` via firebase-admin, or use a dedicated short-lived test account that you demote at the end of the test.

## Important Conventions

- Image filenames: use hyphens, never spaces (e.g. `hoodie-front.JPG` not `hoodie front.JPG`)
- Language: French is primary. Code comments, commit messages, and UI text are in French.
- Currency: EUR. Prices are integers (normal price: both tees 30). Shipping is 5.90 EUR, free above 100 EUR subtotal (`checkout.js` + `cart.html`).
- Frontend uses no build step, no bundler, no framework — plain HTML/CSS/JS.

## Production Domain

- **Real production domain: `https://covestudio.fr`** (no hyphen). `cove-studio.fr` does NOT exist — do not use it.
- Firebase Hosting default URL: `https://covestudio.web.app`
- Cloud Run backend URL: `https://cove-api-2ywkmeggja-ew.a.run.app` (region: europe-west1)

## Deployment

**Claude est en charge de TOUS les déploiements. Ne jamais demander à l'utilisateur de lancer `deploy.ps1` ou `firebase deploy` lui-même.** Dès qu'une modification touche `backend/`, `image/`, ou un fichier HTML/CSS/JS servi en prod, Claude doit lancer le déploiement automatiquement et confirmer le succès avant de rendre la main. Si l'auth gcloud/firebase a expiré, Claude doit le signaler avec la commande exacte à taper, mais jamais déléguer le `deploy.ps1` lui-même à l'utilisateur.

**Mécanisme principal : GitHub Actions** (`.github/workflows/deploy.yml`) — se déclenche automatiquement sur chaque push sur `main`. Déploie Cloud Run + Firebase Hosting en ~2 min. **Mécanisme de secours : `.\deploy.ps1`** exécuté localement (nécessite auth gcloud + firebase **interactive**).

**Variante non-interactive : `.\deploy-auto.ps1`** — à utiliser quand gcloud ET firebase sont déjà authentifiés localement (`gcloud auth list`, `firebase login:list` → `clemence.chab@gmail.com`). Ne fait PAS de `gcloud auth login`/`firebase login` (donc exécutable en arrière-plan sans prompt navigateur) : génère le YAML (avec overlay `.env.production`), `gcloud run deploy`, puis Hosting via `node tests/deploy-hosting.js` (API REST, token gcloud). C'est le chemin utilisé pour les déploiements pilotés par Claude. `deploy.ps1` ET `deploy-auto.ps1` appliquent tous deux l'overlay `.env.production`.

### Required tools (on dev machine)
- Google Cloud SDK at `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd` (this exact path is hardcoded in `deploy.ps1`). If missing, install by downloading and extracting https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-windows-x86_64.zip into `%LOCALAPPDATA%\Google\Cloud SDK\` — the archive contains a `google-cloud-sdk/` folder at its root.
- Firebase CLI: `firebase` from `%APPDATA%\npm\firebase.cmd` (installed via `npm install -g firebase-tools`)

### How `deploy.ps1` works (critical)

The script performs 7 steps:
1. Verify tools
2. `gcloud auth login` — opens browser, interactive
3. `firebase login` — opens browser, interactive
4. **Generates `backend/.env-cloudrun.yaml` from `backend/.env`** — this is the critical step: every KEY=VALUE pair in `backend/.env` is pushed as a Cloud Run env var via `--env-vars-file`. The service account JSON is also base64-encoded and injected as `FIREBASE_SERVICE_ACCOUNT`. `PORT` is removed (reserved by Cloud Run), `NODE_ENV` is forced to `production`.
5. Enable required GCP APIs (run, cloudbuild, artifactregistry)
6. `gcloud run deploy cove-api --source . --region europe-west1 --env-vars-file .env-cloudrun.yaml --memory 512Mi --max-instances 10` — Cloud Build compiles the Docker image from `backend/Dockerfile` and deploys
7. `firebase deploy --only hosting`

### Key implication

**`backend/.env` is the base set of Cloud Run env vars, and `backend/.env.production` overrides it for prod.** `deploy.ps1` step 4 reads `.env`, then overlays `.env.production` (same `KEY=VALUE` format) on top, so any key present in `.env.production` wins for the deployed Cloud Run service. `.env.production` is gitignored.

This resolves the old test/prod tension: **local dev (`npm run dev`) reads only `.env` → stays in Stripe TEST mode with `FRONTEND_URL=http://localhost:3000`**, while **prod gets the LIVE values from `.env.production`** (`STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `FRONTEND_URL=https://covestudio.fr`). Never put live keys in `.env`. If `.env.production` is absent, `deploy.ps1` falls back to `.env` values unchanged.

`STRIPE_WEBHOOK_SECRET` must be set in `.env.production` to the **live** webhook signing secret (Dashboard → Webhooks endpoint on `…/api/webhooks/stripe`, event `checkout.session.completed`); if empty, the webhook returns 400 and paid-status only resolves via the `/api/checkout/verify` polling fallback.

### Running the deploy

From PowerShell:
```powershell
cd C:\dev\clem\Cove
.\deploy.ps1
```
Browser opens twice for `gcloud auth login` and `firebase login` — authenticate with the Google account that owns the `covestudio` GCP + Firebase project. After that, steps 4-7 run unattended (~5-8 min total, most of it is Cloud Build in step 6).

Claude can also run this via `powershell.exe -ExecutionPolicy Bypass -NoProfile -File ./deploy.ps1` as a background task, with the user handling the interactive auth prompts in their browser. Use `Monitor` to stream step-transition events from the output file.

**For Claude-driven deploys, prefer `.\deploy-auto.ps1` run in background** (gcloud + firebase already authed as `clemence.chab@gmail.com`). **Critical footgun:** do NOT wrap the invocation in `*>&1 | Tee-Object` (or any `2>&1`/`*>&1` redirection). In PowerShell 5.1, redirecting a native command's stderr wraps each line in a `NativeCommandError` ErrorRecord; combined with the script's `$ErrorActionPreference = "Stop"`, gcloud's perfectly normal stderr (e.g. `Updated property [core/project].`) becomes a terminating error and kills the deploy at step 1. Run it plainly (`& .\deploy-auto.ps1`) — the background task already captures all output to its own file, so no redirection is needed.

### Known issues

- **⚠️ FOOTGUN MAJEUR — GitHub Actions ≠ overlay `.env.production`.** Le workflow Actions **n'applique PAS** l'overlay `.env.production` : il génère le YAML Cloud Run à partir des **secrets GitHub** (`secrets.STRIPE_SECRET_KEY`, etc., cf. step « Générer le fichier env vars »). Donc **la source de vérité des clés prod en déploiement Actions, ce sont les secrets GitHub, pas `.env.production`**. Si un secret GitHub contient une clé **test**, chaque `push` sur `main` **rebascule silencieusement la prod en mode test** (Stripe « Your request was in test mode, but used a non test card », webhook 400/absent). C'est arrivé le 2026-06-15 : `STRIPE_SECRET_KEY` (GH) contenait `sk_test` et `STRIPE_WEBHOOK_SECRET` (GH) était absent → tous les déploiements Actions de la session ont mis la prod en test. **Corrigé** : les deux secrets GitHub ont été remis aux valeurs **live** via `gh secret set ... < .env.production`. Règle : **les secrets GitHub Stripe DOIVENT être les valeurs live de `backend/.env.production`** (`sk_live`, `whsec…`), jamais celles de `.env`. Vérifier le mode réellement déployé : `gcloud run services describe cove-api --region europe-west1 --project covestudio --format=json` puis lire `STRIPE_SECRET_KEY` (doit commencer par `sk_live`). `deploy-auto.ps1`/`deploy.ps1` (overlay `.env.production`) restent corrects ; seul Actions dépend des secrets GH.
- **Étape Hosting Actions en `continue-on-error` (2026-07-01)** : quand on déploie Hosting manuellement (`tests/deploy-hosting.js`) AVANT le push, l'étape « Deploy frontend sur Firebase Hosting » d'Actions échoue sur une **400 « supplied version is the current active version »** (re-release d'une version identique déjà live) → job rouge + mail d'alerte GitHub, alors que rien n'est cassé. Fix : l'étape Hosting du workflow a `continue-on-error: true` (le déploiement Cloud Run, à l'étape précédente, reste bloquant). Donc un no-op Hosting ne fait plus échouer le job. Contrepartie assumée : un vrai échec Hosting via Actions passerait aussi inaperçu — acceptable car Hosting est de toute façon déployé/vérifié manuellement.
- **GitHub Actions workflow** (`.github/workflows/deploy.yml`): le workflow utilise le SA `github-actions-deploy@covestudio.iam.gserviceaccount.com` (créé 2026-05-31). Ce SA a les rôles `run.admin`, `cloudbuild.builds.editor`, `artifactregistry.writer`, `storage.admin`, `iam.serviceAccountUser`, `firebase.admin`. La clé JSON est dans `github-actions-sa-key.json` à la racine.
  - **Secrets GitHub requis** (à configurer dans Settings → Secrets and variables → Actions) :
    - `GCP_SA_KEY` → contenu brut de `github-actions-sa-key.json`
    - `FIREBASE_SERVICE_ACCOUNT_B64` → contenu de `firebase-sa-b64.txt` (base64 du SA Firebase)
    - `FIREBASE_DATABASE_URL` → `https://covestudio-default-rtdb.europe-west1.firebasedatabase.app`
    - `FIREBASE_API_KEY` → voir `backend/.env`
    - `EMAIL_USER` → `cove.off@gmail.com`
    - `EMAIL_PASS` → voir `backend/.env`
    - `OWNER_EMAIL` → `cove.off@gmail.com`
    - `STRIPE_SECRET_KEY` → **valeur LIVE** (`sk_live…`) de `backend/.env.production`, PAS `.env` (cf. footgun ci-dessus)
    - `STRIPE_WEBHOOK_SECRET` → **valeur LIVE** (`whsec…`) de `backend/.env.production`
    - `FIREBASE_TOKEN` → générer via `firebase login:ci` (pour le deploy Hosting)
- **Firebase Hosting step (deploy.ps1)** peut échouer avec `Failed to get Firebase project covestudio.` — means the `firebase login` account lacks permissions on the project. The backend (Cloud Run) deploy succeeds independently, so backend-only fixes still go through. Resolve by re-logging in with an account that has Firebase roles on `covestudio`, or running `firebase deploy --only hosting` separately with the right account.
- **Workaround when the Firebase CLI auth can't be refreshed**: `tests/deploy-hosting.js` is a standalone Node script that deploys Hosting via the Firebase Hosting REST API directly, using gcloud's access token (gcloud is authenticated as `clemence.chab@gmail.com`). It walks the public dir per `firebase.json` ignore list, gzips each file, runs the full `createVersion → populateFiles → upload → FINALIZED → release` flow. Run with `node tests/deploy-hosting.js`. Useful when `firebase login` is stuck on a wrong account and you need to ship a frontend change immediately. Critical detail: the REST API field is `glob`, not `source` (as in `firebase.json`) — the script translates it. It also translates `firebase.json` `headers` (CLI format `[{key,value}]`) into the REST `headers` map (`{cle: valeur}`) and sends `config: { rewrites, headers }`. **If you add anything to `firebase.json` beyond rewrites/headers (e.g. `cleanUrls`, `redirects`, `trailingSlash`), this script will silently drop it** — it only forwards rewrites + headers. Extend the script if needed.
- **Cache des assets / "mes modifs n'apparaissent pas sur le téléphone"** : par défaut Firebase Hosting sert les fichiers avec `Cache-Control: max-age=3600` (1h). Résultat : après un déploiement, les navigateurs (surtout mobiles) gardent l'ancien HTML/CSS/JS jusqu'à 1h → l'utilisateur voit une version périmée. Fix en place : `firebase.json` → `headers` force `Cache-Control: no-cache` sur `**/*.@(html|css|js)` (revalidation par ETag, renvoie 304 si inchangé). Les images gardent le cache long par défaut. Vérifier après deploy : `curl -sI https://covestudio.fr/css/style.css | grep -i cache-control` doit renvoyer `no-cache`. Note : un changement de header ne purge pas le cache déjà posé chez l'utilisateur — il faut UN dernier hard-refresh côté client après le passage à `no-cache`.
- **`backend/NUL` device file cause un crash ZIP** : Windows expose le device `NUL` comme un fichier dans `backend/`. gcloud essaie de le zipper et plante avec `ZIP does not support timestamps before 1980`. Fix : `NUL` est dans `backend/.gcloudignore`. Ne pas le supprimer de `.gcloudignore`.
- **Mise à jour gcloud peut casser le module `six`** : si `gcloud components update` tourne en mode non-interactif, il peut corrompre les packages Python bundled. Symptôme : `ModuleNotFoundError: No module named 'six'`. Fix : `& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe" -m pip install six`.
- **`deploy.ps1` hardcodes the service account JSON filename** (`covestudio-firebase-adminsdk-fbsvc-854611e7e9.json`). If the key is rotated, update both the file on disk and the path in `deploy.ps1` line 63.

### Verifying a deploy
```bash
# Health check
curl https://cove-api-2ywkmeggja-ew.a.run.app/api/health

# Inspect Cloud Run env vars (to confirm FRONTEND_URL, etc.)
"$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd" run services describe cove-api \
  --region europe-west1 --project covestudio --format=json | grep -A1 FRONTEND_URL
```

### End-to-end Stripe redirect test

`tests/prod-stripe-redirect.js` is a standalone Playwright script (no test runner) that hits `https://covestudio.fr` directly, adds a T-shirt to cart, fills the checkout form, pays with Stripe test card `4242 4242 4242 4242`, and asserts the final URL is on `covestudio.fr/success.html`. Run with `node tests/prod-stripe-redirect.js`. It opens a visible Chromium window (`headless: false`, `slowMo: 800`). Use this to verify post-deploy that the full payment flow works against prod.

## Self-maintenance of this file

This CLAUDE.md is a living document. On every session, Claude must:

1. **Verify before trusting.** Any file path, command, URL, version, or convention stated here is a claim about *past* state. Before acting on it in a way the user will rely on, spot-check it against the current repo (read the file, run the command, curl the URL). If the claim is stale, fix it in this file before proceeding.
2. **Record hard-won knowledge.** When a session uncovers non-obvious information — a deployment gotcha, a hidden dependency, an environment-variable footgun, an incorrect assumption the user or prior Claude made, the *why* behind a design choice — add it to the relevant section of this file in the same turn. "Hard-won" means: the kind of thing the next session would otherwise have to rediscover by trial and error.
3. **Prefer editing over appending.** If a section already covers the topic, rewrite or extend it in place rather than tacking on a new subsection. Keep the file navigable.
4. **Delete what's wrong.** If a claim in this file turns out to be false or outdated, remove it or correct it immediately. Do not leave `// NOTE: this might be wrong` comments — fix it.
5. **Keep it concrete.** Favor exact paths, exact commands, exact error messages, exact values over generalities. The reader is a future Claude session with no memory of this one.
6. **Respect the user's time.** Don't bloat the file with trivia. The test is: would a new session that reads only this file be meaningfully better off? If not, don't add it.

Do not ask permission to update CLAUDE.md when the trigger conditions above are met — just do it, and mention it briefly in the session summary.
