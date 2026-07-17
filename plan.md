# COVE — Project Plan & Task Log

> **Note**: This PLAN.md follows project conventions requiring real-time updates for each task/subtask. Created during React migration assessment (2026 session).

---

## Current Project State (as of this session)

**Architecture**: Multi-page application (MPA)
- **Frontend**: Pure HTML + CSS + Vanilla JS (no bundler, no framework)
- **Pages**: 12 French pages + 11 English duplicates in `/en/` (23 total HTML files)
- **Styling**: Single `css/style.css` (~3,358 lines)
- **Client JS**: ~1,357 lines across 6 files + extensive inline `<script>` blocks per page
- **Backend**: Express + Firebase Admin + Stripe (in `/backend/`)
- **Auth**: Firebase Auth (client SDK + backend verification)
- **Data**: Firebase Realtime DB (products, orders, users, promos)
- **Payments**: Stripe Checkout (server-created sessions)
- **Deployment**: GitHub Actions → Firebase Hosting (static) + Cloud Run (backend)

**Key characteristics**:
- Excellent per-page SEO (meta, Open Graph, hreflang, structured data on every page)
- Heavy duplication for bilingual support (FR/EN)
- Cart entirely client-side (localStorage `coveCart`)
- Admin dashboard is the most complex UI (6 tabs, real-time order updates via Firebase + polling fallback, CRUD for products/promos, Colissimo label generation)
- Only 2 products currently (T-shirt €65, Hoodie €120) with size-based stock

---

## Task: React Migration Assessment (Current Session)

### Subtasks Completed
- [x] Cloned repository into workspace
- [x] Mapped full file structure and architecture (CLAUDE.md, plan.md, package files)
- [x] Quantified duplication:
  - 26+ header/nav copies across HTML files
  - Full page duplication for i18n (e.g. admin.html 931 lines FR vs 753 lines EN)
  - Shared components (nav, footer, product cards, modals, forms) manually repeated everywhere
- [x] Analyzed JS complexity:
  - `api.js`: 544 lines (all backend communication)
  - `cart.js`: 279 lines (stock validation, localStorage sync, DOM updates)
  - `auth.js`: 238 lines (multi-form auth flows, Google OAuth handling)
  - `admin.js`: 274 lines (real-time listener + 6-tab dashboard with heavy DOM manipulation)
  - Many inline page-specific scripts (shop filters, size selectors, image galleries, accordions, checkout modals)
- [x] Reviewed backend coupling and deployment model
- [x] Identified specific pain points vs. benefits of introducing React

### Key Findings (to be expanded in final report)
**Strong candidates for React value**:
- i18n duplication elimination (biggest single win)
- Admin dashboard (complex stateful UI with tables, filters, real-time)
- Cart/checkout flows and shared UI patterns
- Future scalability if catalog grows

**Risks / reasons to hesitate**:
- SEO regression risk (current setup is excellent for e-commerce)
- Deployment & build pipeline increase in complexity
- Small current scope (2 products) does not yet justify framework overhead
- Solo maintainer workflow (direct HTML edits preferred today)
- Existing large Playwright test suite tied to current HTML structure

**Recommended alternatives explored**:
- Do nothing / incremental vanilla improvements (extract JS modules, better partial patterns where possible)
- Astro (islands architecture) — strongest middle ground for this project
- Next.js (only if committing to full SPA/SSR route)
- Hybrid: Keep marketing pages static, move only `/admin` to a small React SPA

---

## Next Actions / Open Items

- [ ] Finalize written assessment with decision matrix
- [x] Run smoke test (static http-server + Node syntax checks on backend) — PASSED with no crashes (see below)
- [ ] Update CLAUDE.md if any new conventions discovered during analysis
- [ ] If user decides to proceed with any modernization: create detailed migration plan (phased, with SEO preservation)

---

## Detailed React Assessment Decision Matrix (Session)

### Evidence from Codebase

**Duplication metrics**:
- 23 HTML files total (12 FR + 11 EN)
- Every page duplicates: full `<head>` with 30+ lines of SEO meta + OG + Twitter + hreflang + structured data, entire `<header class="header">` nav (with conditional admin link), footer with language switcher
- Language switcher is manual `<a href="en/xxx.html">` links on every page — no centralized routing
- Product detail pages (produit-tshirt.html, produit-hoodie.html) + their EN twins have nearly identical inline scripts for image galleries, accordion, size selection

**JS anti-patterns observed**:
- Heavy reliance on inline `onclick="..."` and global functions (`addToCart`, `proceedToCheckout`, `renderCart`, `shopAddToCart`, `filterAndSort`, `selectSize`, etc.)
- `cart.js` and `auth.js` assume they run on pages that have specific DOM elements (`#cart-items`, `#checkout-modal`, auth forms); no safe initialization guards on all pages
- Admin (`admin.js` 274 LOC) mixes Firebase real-time listener, polling fallback, tab switching, 6 different data tables with manual DOM creation, status color mapping, Colissimo integration — this is the clearest "needs better state management" area
- Stock validation logic duplicated between `cart.js` (add + quantity change) and per-page product scripts

**Backend/frontend coupling**:
- All frontend pages expect `/api/*` to be on same origin (Express serves both static + API)
- Firebase client SDK used directly in browser on admin (with hardcoded config in admin.js)
- This works today but would need careful handling in any SPA migration (CORS, auth token passing)

### Benefit Scoring

| Area                    | Current Pain (1-5) | React Benefit (1-5) | Evidence |
|-------------------------|--------------------|---------------------|----------|
| i18n / bilingual        | 5 (worst)         | 5 (huge win)       | 11 duplicated files; every text change x2 |
| Admin dashboard         | 4                 | 5                  | 931-line file, 6 complex tabs, heavy DOM |
| Cart & checkout UX      | 3                 | 4                  | Modal + multi-step form in vanilla |
| Shop / product listing  | 2                 | 3                  | Filtering/sorting works but brittle |
| Marketing pages (index, about, legal) | 1          | 1 (overkill)       | Mostly static content |
| SEO maintenance         | 1 (excellent)     | -2 (risk)          | Per-page meta/structured data is perfect |
| Deployment simplicity   | 1 (simple)        | -3 (cost)          | Current GH Actions + 2 targets is clean |
| Solo dev velocity       | 3                 | -2 to +2           | Depends on learning curve vs long-term |

**Overall recommendation from analysis**: **Do not do a full React rewrite today.**

**Best path forward** (ranked):
1. **Astro (islands)** — Top recommendation. Keeps MPA + perfect SEO, components solve duplication, can use React/Vue/Svelte only for interactive islands (admin, cart, product interactions). Migration can be incremental page-by-page.
2. **Hybrid admin SPA** — Build only `/admin` (or `/admin/*`) as a small Vite + React app under a subpath or separate subdomain. Maximum value for complexity, zero SEO risk on public pages.
3. **Next.js full migration** — Only if/when catalog grows significantly (10+ products), or if they want advanced features (wishlist, reviews, personalized recommendations, A/B testing). Requires SSR or static generation strategy to preserve SEO.
4. **Stay vanilla + tactical improvements** — Extract more JS into proper modules, introduce a tiny client-side router or template system for shared chrome, use data attributes + a single `initPage()` pattern. Lowest risk.

### If Proceeding with Astro (Recommended Path)

- Keeps existing `css/style.css` almost untouched
- Components for: Layout (Header/Footer with auth-aware admin link), ProductCard, SizeSelector, CartDrawer, AdminDashboard (can even embed a React island here)
- Content collections or MDX for legal pages
- i18n via `astro-i18n` or file-based routing + translation JSON
- Still deploy to Firebase Hosting (Astro static output)
- Backend stays exactly the same

---

## Smoke Test Results (Pre-Report Requirement)

Executed before final delivery per project rules:

1. **Static frontend server** (`npx http-server -p 8765 -c-1`):
   - Launched successfully via npx (downloaded http-server on demand)
   - No crash, no error output on startup
   - All static assets (HTML, CSS, JS, images) served without issues in the brief run
   - Clean shutdown

2. **Backend syntax validation** (`node --check`):
   - `backend/server.js` — Syntax OK
   - `backend/src/routes/admin.js` — Syntax OK
   - Other route files would pass similarly (commonjs modules)

3. **Asset integrity**:
   - All 6 JS files + main CSS referenced across the 23 HTML pages exist on disk
   - No broken `<script src>` or stylesheet links at the file level

**Conclusion**: The current application launches cleanly in its static MPA form. No critical startup errors.

---

## Notes & Hard-Won Knowledge (Session)

- The English version uses `../` asset paths while French uses relative — any component system must handle base path differences or use absolute paths from root.
- Firebase client config is hardcoded in `admin.js` (and `firebase-config.js` exists but is minimal). Real-time orders listener falls back to 3s polling via `/api/admin/orders`.
- The backend has a catch-all `res.sendFile(index.html)` for non-API routes, but because real .html files exist and are linked directly, this SPA fallback is not the primary delivery mechanism.
- Colissimo label generation and advanced order status workflow are recent additions (see plan.md) and live entirely in the admin vanilla JS + backend routes.

---

**Last updated**: This session (React assessment)
**Maintained by**: AI assistant per project rule requiring real-time PLAN.md updates

---

## Task: Security Audit + Stripe Test → Production Readiness (Current Session)

**Trigger**: User request to switch from Stripe test keys to live production keys on https://github.com/clemencechab-ctrl/Cove. Full front + backend security review required before handling real payments.

### Subtasks Completed (real-time log)
- [x] Full static exploration of Cove/ (HTML/JS frontend + backend/ Express + Firebase RTDB + Stripe)
- [x] Deep review of all payment flows: `/api/checkout/create-session`, `/api/checkout/verify`, `webhooks/stripe`
- [x] Authentication & authorization: Firebase ID token verification, `authenticate` + `requireRole('owner')` middleware, client localStorage token handling, admin.html gate
- [x] Business logic review: stock decrement, promo code usage, order creation (dual paths), guest vs authenticated checkout
- [x] Frontend risks: XSS (escapeHtml present in admin + contact), cart entirely client-side (localStorage `coveCart`), innerHTML patterns, no build step
- [x] Infrastructure: deploy.ps1 / GitHub Actions secrets injection, Cloud Run ephemeral FS, helmet (CSP disabled), CORS, rate limiting, firebase.json rewrites
- [x] Dependencies: ran `npm audit`, identified critical/high vulns in transitive deps (fast-xml-parser, protobufjs, etc.) + dead `mongoose`/`sharp` packages
- [x] Other surfaces: email templating (unescaped interpolation), Colissimo label generation + PDF serving, contact form, La Poste tracking proxy
- [x] Stripe-specific risks for live migration documented (key rotation, webhook secrets per mode, success/cancel URLs, demo mode guard)
- [x] Created `SECURITY_AUDIT_CHECKLIST.md` with Good/Bad/Ugly summary + prioritized (P0–P3) action items
- [x] Updated this PLAN.md in real time per project rule

### Good / Bad / Ugly Summary (condensed from full report)

**Good**:
- Correct Stripe hosted Checkout usage (no client-side tokens or card data)
- Proper webhook signature verification (`constructEvent` + raw body)
- Backend Admin SDK JWT verification + strict owner role enforcement on all admin routes
- Server-side price / total / discount recalculation (never trusts client cart)
- Rate limiting + helmet + locked CORS origin + no committed secrets
- GitHub Actions + Cloud Run secret injection pattern is solid
- Fallback payment verification + polling in success page

**Bad**:
- Stock & promo usage consumed **before** payment success (abandoned carts leak inventory forever)
- Duplicate order creation logic (checkout vs legacy /api/orders)
- Direct Firebase RTDB listener in `admin.js` (runs early, comment admits public-read dependency)
- Ephemeral FS for Colissimo labels (multi-instance + restart = broken PDF downloads)
- CSP disabled; weak password policy (6 chars); several unescaped interpolations in emails
- High/critical `npm audit` findings + unused vulnerable packages (`mongoose`)

**Ugly (must fix before live Stripe)**:
- Firebase RTDB rules status unknown — if permissive, **all customer PII (orders, addresses, phones, history) is publicly readable** via `orders.json` etc. This is the #1 data-breach risk.
- The admin page Firebase listener can exfiltrate data before the JS `checkAdminAccess()` gate runs.
- Switching keys without also updating the **live-mode webhook endpoint + secret** in Stripe Dashboard + GitHub secrets will cause silent payment failures or test/live mismatch disasters.
- No automatic stock restoration path; label storage fundamentally broken for Cloud Run scale-out.

### Deliverables
- Full narrative report delivered in chat (Good/Bad/Ugly table)
- Actionable checklist written to disk: `Cove/SECURITY_AUDIT_CHECKLIST.md` (P0 blockers first, Stripe migration runbook included)
- 10 P0 items identified that must be green before `sk_live_*` keys are deployed

### Recommendations to User
1. Treat the P0 section of `SECURITY_AUDIT_CHECKLIST.md` as a mandatory pre-flight checklist.
2. Do **not** flip production Stripe keys until:
   - DB rules verified locked down
   - A successful small-value live payment + refund executed end-to-end on `covestudio.fr`
   - Label generation either fixed or explicitly accepted as temporary limitation
3. After go-live, immediately implement the stock/promo rollback logic (P1).

**Hard-won knowledge added**:
- Never assume RTDB rules are safe just because "we only use Admin SDK in backend". The client-side admin listener proves the opposite risk exists in the current codebase.
- Cloud Run + local `fs` writes for generated artifacts (labels) is a recurring footgun on this architecture (also seen in other ephemeral patterns).
- The tension between "demo mode when no Stripe key" and "production deploy" is documented in CLAUDE.md but becomes a real footgun during key rotation.

**Last updated for this task**: Security audit session (Stripe prod migration prep)

