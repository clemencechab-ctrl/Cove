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
│   ├── admin.js              # Admin dashboard + Firebase real-time listener
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
- **Authentication:** Firebase Auth (email/password + Google OAuth). Backend verifies JWT via `admin.auth().verifyIdToken()`. Roles stored in RTDB at `/users/{uid}/role` (`client` or `owner`).
- **Cart:** Entirely client-side in localStorage (`coveCart` key). No server-side cart.
- **Products:** Currently 2 products (T-shirt id:1 65 EUR, Hoodie id:2 120 EUR) with per-size stock (`sizeStock: {S, M, L, XL}`).
- **Admin:** Protected by `requireRole('owner')` middleware. Admin page has Firebase real-time listener with polling fallback.
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

## Environment

- Backend env file: `backend/.env` (see `backend/.env.example` for template)
- Firebase service account JSON at project root (referenced in `backend/src/config/firebase.js`)
- Firebase project: `covestudio` (europe-west1)

## Admin / Owner account

**The sole admin (owner) account for production is `clemence.chab@gmail.com`** (Google OAuth). This must remain the only account with `role: "owner"` in `users/{uid}/role`. Do not grant owner to any other account without explicit instruction; demote any account you accidentally promote during testing.

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | test-user@cove-test.com | CoveTest2026! |
| Client | test-owner@cove-test.com | CoveOwner2026! (historically seeded as owner, now demoted to client) |

If a test needs an owner session, **do not** promote `test-owner@cove-test.com` — instead, mint a Firebase custom token for `clemence.chab@gmail.com` via firebase-admin, or use a dedicated short-lived test account that you demote at the end of the test.

## Important Conventions

- Image filenames: use hyphens, never spaces (e.g. `hoodie-front.JPG` not `hoodie front.JPG`)
- Language: French is primary. Code comments, commit messages, and UI text are in French.
- Currency: EUR. Prices are integers (65, 120).
- Frontend uses no build step, no bundler, no framework — plain HTML/CSS/JS.

## Production Domain

- **Real production domain: `https://covestudio.fr`** (no hyphen). `cove-studio.fr` does NOT exist — do not use it.
- Firebase Hosting default URL: `https://covestudio.web.app`
- Cloud Run backend URL: `https://cove-api-2ywkmeggja-ew.a.run.app` (region: europe-west1)

## Deployment

**Claude est en charge de TOUS les déploiements. Ne jamais demander à l'utilisateur de lancer `deploy.ps1` ou `firebase deploy` lui-même.** Dès qu'une modification touche `backend/`, `image/`, ou un fichier HTML/CSS/JS servi en prod, Claude doit lancer le déploiement automatiquement et confirmer le succès avant de rendre la main. Si l'auth gcloud/firebase a expiré, Claude doit le signaler avec la commande exacte à taper, mais jamais déléguer le `deploy.ps1` lui-même à l'utilisateur.

**Mécanisme principal : GitHub Actions** (`.github/workflows/deploy.yml`) — se déclenche automatiquement sur chaque push sur `main`. Déploie Cloud Run + Firebase Hosting en ~2 min. **Mécanisme de secours : `.\deploy.ps1`** exécuté localement (nécessite auth gcloud + firebase interactive).

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

**`backend/.env` is the source of truth for Cloud Run env vars.** When modifying production config, edit `backend/.env` then run `.\deploy.ps1`. In particular, `FRONTEND_URL` must be `https://covestudio.fr` for Stripe `success_url`/`cancel_url` to redirect to the correct domain after payment.

Because `.env` is also read by the local dev backend (`npm run dev`), there is a tension: changing `FRONTEND_URL=https://covestudio.fr` for prod means local Stripe tests also redirect to prod. This is currently accepted since Stripe is rarely tested locally. If it becomes an issue, split into `.env.production` or override `FRONTEND_URL` via Cloud Run secrets directly (which would require modifying `deploy.ps1`).

### Running the deploy

From PowerShell:
```powershell
cd C:\dev\clem\Cove
.\deploy.ps1
```
Browser opens twice for `gcloud auth login` and `firebase login` — authenticate with the Google account that owns the `covestudio` GCP + Firebase project. After that, steps 4-7 run unattended (~5-8 min total, most of it is Cloud Build in step 6).

Claude can also run this via `powershell.exe -ExecutionPolicy Bypass -NoProfile -File ./deploy.ps1` as a background task, with the user handling the interactive auth prompts in their browser. Use `Monitor` to stream step-transition events from the output file.

### Known issues

- **GitHub Actions workflow** (`.github/workflows/deploy.yml`): le workflow utilise le SA `github-actions-deploy@covestudio.iam.gserviceaccount.com` (créé 2026-05-31). Ce SA a les rôles `run.admin`, `cloudbuild.builds.editor`, `artifactregistry.writer`, `storage.admin`, `iam.serviceAccountUser`, `firebase.admin`. La clé JSON est dans `github-actions-sa-key.json` à la racine.
  - **Secrets GitHub requis** (à configurer dans Settings → Secrets and variables → Actions) :
    - `GCP_SA_KEY` → contenu brut de `github-actions-sa-key.json`
    - `FIREBASE_SERVICE_ACCOUNT_B64` → contenu de `firebase-sa-b64.txt` (base64 du SA Firebase)
    - `FIREBASE_DATABASE_URL` → `https://covestudio-default-rtdb.europe-west1.firebasedatabase.app`
    - `FIREBASE_API_KEY` → voir `backend/.env`
    - `EMAIL_USER` → `cove.off@gmail.com`
    - `EMAIL_PASS` → voir `backend/.env`
    - `OWNER_EMAIL` → `cove.off@gmail.com`
    - `STRIPE_SECRET_KEY` → voir `backend/.env`
    - `STRIPE_WEBHOOK_SECRET` → voir `backend/.env`
    - `FIREBASE_TOKEN` → générer via `firebase login:ci` (pour le deploy Hosting)
- **Firebase Hosting step (deploy.ps1)** peut échouer avec `Failed to get Firebase project covestudio.` — means the `firebase login` account lacks permissions on the project. The backend (Cloud Run) deploy succeeds independently, so backend-only fixes still go through. Resolve by re-logging in with an account that has Firebase roles on `covestudio`, or running `firebase deploy --only hosting` separately with the right account.
- **Workaround when the Firebase CLI auth can't be refreshed**: `tests/deploy-hosting.js` is a standalone Node script that deploys Hosting via the Firebase Hosting REST API directly, using gcloud's access token (gcloud is authenticated as `clemence.chab@gmail.com`). It walks the public dir per `firebase.json` ignore list, gzips each file, runs the full `createVersion → populateFiles → upload → FINALIZED → release` flow. Run with `node tests/deploy-hosting.js`. Useful when `firebase login` is stuck on a wrong account and you need to ship a frontend change immediately. Critical detail: the REST API field is `glob`, not `source` (as in `firebase.json`) — the script translates it.
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
