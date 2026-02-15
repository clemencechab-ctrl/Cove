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

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | test-user@cove-test.com | CoveTest2026! |
| Owner | test-owner@cove-test.com | CoveOwner2026! |

Owner role must be set manually in Firebase RTDB: `users/{uid}/role = "owner"`.

## Important Conventions

- Image filenames: use hyphens, never spaces (e.g. `hoodie-front.JPG` not `hoodie front.JPG`)
- Language: French is primary. Code comments, commit messages, and UI text are in French.
- Currency: EUR. Prices are integers (65, 120).
- Frontend uses no build step, no bundler, no framework — plain HTML/CSS/JS.
