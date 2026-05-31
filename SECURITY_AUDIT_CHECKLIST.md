# COVE Security Audit Checklist — Stripe Test → Production Migration

**Date**: 2026 (audit performed on current codebase)  
**Scope**: Full front-end (static HTML/JS) + back-end (Express/Node on Cloud Run) + deployment (GitHub Actions, Firebase Hosting, Cloud Run) + Stripe integration  
**Context**: Preparing switch from `sk_test_*` / test webhook secret to live Stripe keys. This is a high-risk change involving real money, customer PII, and PCI considerations.

---

## Priority Legend
- **P0 - Critical (Blocker for Prod Stripe)**: Do before touching live keys. Financial, data breach, or total breakage risk.
- **P1 - High**: Strong security/compliance issues. Fix before or immediately after go-live.
- **P2 - Medium**: Best practices, abuse prevention, maintainability. Address in next sprint.
- **P3 - Low / Polish**: Nice-to-haves, tech debt.

---

## P0 — Critical (Stripe Go-Live Blockers)

- [ ] **Verify & lock Firebase Realtime Database security rules**
  - Confirm `/orders`, `/users`, `/contactMessages`, `/promoCodes` etc. are **not** publicly readable.
  - Rules must require `auth != null` + owner role checks for sensitive paths (or rely 100% on backend Admin SDK).
  - Test: open `https://covestudio-default-rtdb.europe-west1.firebasedatabase.app/orders.json` in incognito (should 401/403 or empty).
  - Update `admin.js` Firebase listener comment and behavior if rules are now strict (it already has polling fallback).

- [ ] **Rotate / prepare Stripe Live credentials**
  - In Stripe Dashboard (Live mode):
    - Create/retrieve `STRIPE_SECRET_KEY=sk_live_...`
    - Create/retrieve endpoint-specific `STRIPE_WEBHOOK_SECRET=whsec_...` for the **live** webhook URL.
  - Add/update GitHub Actions secrets:
    - `STRIPE_SECRET_KEY` (live)
    - `STRIPE_WEBHOOK_SECRET` (live)
  - **Never** mix test/live in same deploy.

- [ ] **Register the live webhook endpoint in Stripe Dashboard (Live mode)**
  - URL: `https://cove-api-2ywkmeggja-ew.a.run.app/api/webhooks/stripe` (confirm via `gcloud run services describe`)
  - Events: `checkout.session.completed` (at minimum)
  - Copy the exact `whsec_...` secret after creation.

- [ ] **Update `FRONTEND_URL` and test redirect URLs**
  - Confirm `backend/.env` (source of truth) has `FRONTEND_URL=https://covestudio.fr`
  - Re-deploy will push it to Cloud Run.
  - Verify success/cancel URLs in live Stripe sessions will land on `https://covestudio.fr/success.html?...`

- [ ] **Run full end-to-end live Stripe test (small amount)**
  - Use `tests/prod-stripe-redirect.js` (or manual) against **https://covestudio.fr** with a real low-value card after keys are live.
  - Confirm: redirect to Stripe live, payment succeeds, webhook fires, order marked `paid`, emails sent, user lands on success page.
  - Immediately refund the test transaction.

- [ ] **Audit current RTDB for any test PII / orders before go-live**
  - Export or manually review `/orders` and `/users`.
  - Consider wiping or anonymizing old test orders that contain real emails/addresses before accepting live payments.

- [ ] **Disable or heavily restrict demo mode in production**
  - `!process.env.STRIPE_SECRET_KEY` currently creates "demo" orders and marks them paid instantly.
  - In live env this must never trigger. Add explicit guard + alerting if demo path is hit on prod domain.

- [ ] **Confirm Colissimo (or fallback) label generation works end-to-end in prod**
  - Current implementation writes PDFs to ephemeral `/labels` dir on Cloud Run instance.
  - Test: create order → generate label as owner → download PDF. Expect 404s across instances or after restart.

---

## P1 — High (Fix Before or Right After Go-Live)

- [ ] **Fix inventory & promo code consumption on abandoned/cancelled payments**
  - Currently: stock decremented + promo `currentUses` incremented in `/create-session` **before** Stripe payment.
  - On cancel or failed payment, inventory and promo quota are lost forever.
  - Options:
    - Move stock/promo decrement to webhook `checkout.session.completed` only (preferred, but requires handling race with client /verify).
    - Or implement compensation: on cancel webhook + timeout job that restores stock and decrements promo uses.
    - At minimum: add manual "restore stock" button in admin for cancelled orders.

- [ ] **Remove or justify unused vulnerable dependencies**
  - `mongoose` and `sharp` appear in `backend/package.json` but are never `require()`d in `src/`.
  - They bring high/critical transitive vulns. Run `npm uninstall mongoose sharp` (root too if only used in scripts).

- [ ] **Harden admin page Firebase listener & remove direct RTDB reads if possible**
  - The top-level `database.ref('orders').on(...)` in `admin.js` executes for every visitor to `/admin.html` (even before `checkAdminAccess()`).
  - If rules ever loosen or during transition, full order history leaks.
  - Prefer: remove the Firebase listener entirely and rely only on authenticated polling (already implemented as fallback). Or gate the Firebase init strictly behind successful owner token + role check.

- [ ] **Add missing rate limiting on payment & promo endpoints**
  - `/api/checkout/create-session`, `/api/checkout/validate-promo`, `/api/checkout/verify` have only the global 1000/15min limit.
  - Add stricter per-IP or per-email limits (e.g. 10 checkouts per 15 min, 5 promo validations per minute) to prevent abuse / enumeration.

- [ ] **Escape user-controlled data in all email templates**
  - `sendOrderConfirmation`, `sendOrderStatusUpdate`, contact notifications etc. interpolate `item.name`, `customer.firstName`, addresses, etc. directly into HTML without escaping.
  - Low risk for most email clients, but still a vector for broken rendering or social engineering. Add a `escapeHtmlForEmail` helper.

- [ ] **Make label PDF storage persistent or move to Firebase Storage**
  - Current: `fs.writeFileSync` to `backend/labels/` (ephemeral on Cloud Run + instance affinity problem).
  - Store generated PDFs in Firebase Storage (already used for product images) with signed or public URLs stored in the order record.
  - Update `generate-label` route + label serving route accordingly.
  - Delete local `labels/` usage.

- [ ] **Add basic monitoring / alerting for Stripe webhooks & payment failures**
  - Log + alert (email/Slack) on:
    - Webhook signature failures
    - `checkout.session.completed` with `payment_status != paid`
    - Repeated fallback verify calls
    - Demo mode triggered in prod
  - Consider a simple Cloud Logging metric + alert or external service.

- [ ] **Review & tighten CORS + security headers for production**
  - `helmet` has CSP and COEP explicitly disabled. Evaluate enabling a strict CSP (at least for admin.html and checkout pages).
  - Confirm Cloud Run response headers (HSTS, etc.) via `curl -I https://cove-api.../api/health`.
  - Firebase Hosting can add headers via `firebase.json`.

- [ ] **Strengthen password policy & add basic account protections**
  - Current minimum: 6 characters (Firebase default).
  - Enforce 12+ chars + complexity on registration (client + server).
  - Consider rate-limit + progressive delays or temporary lockout after N failed logins for the same email (beyond current 20/15min global).

- [ ] **Document owner account recovery & "break-glass" procedures**
  - Only `clemence.chab@gmail.com` is owner.
  - What if that Google account is lost? Document emergency procedure (Firebase console direct role grant, etc.).

---

## P2 — Medium (Address in Follow-up Sprint)

- [ ] **Eliminate duplicate order creation logic**
  - `/api/orders` POST (used by some tests/legacy?) and `/api/checkout/create-session` both create orders, decrement stock, etc.
  - Consolidate to a single internal `createOrderWithStockAndPromo` service function.

- [ ] **Improve error handling & information disclosure**
  - Many routes return `error.message` directly (can leak stack traces or internal details in some paths).
  - Standardize: user-safe messages + server-side detailed logging only.

- [ ] **Add CSRF / request origin validation for state-changing endpoints**
  - Bearer token + CORS is mostly sufficient, but for extra defense (especially if any cookie auth appears later), add Origin/Referer checks or double-submit cookie on sensitive admin actions.

- [ ] **Client-side input sanitization + server-side strict validation parity**
  - Review every form (checkout, contact, profile, admin CRUD) for missing server validation.
  - Add max lengths, allowed chars where appropriate (postalCode, phone, promo codes).

- [ ] **Address npm audit findings (beyond unused packages)**
  - Pin or update firebase-admin, express-rate-limit, etc. once upstream fixes or workarounds exist.
  - Add `npm audit` step to CI (fail on high+ or with exceptions list).

- [ ] **Add automated security tests**
  - Playwright or dedicated supertest suite covering:
    - Unauthorized access to all `/api/admin/*`
    - Role escalation attempts
    - Promo abuse (reuse after maxUses, negative values)
    - Stock over-selling attempts
    - Webhook replay / tampering (already partially covered by signature tests)

- [ ] **RGPD / data minimization & retention policy**
  - French site → RGPD applies.
  - Orders contain full names, phones, addresses indefinitely.
  - Implement:
    - User data export endpoint (authenticated)
    - Soft-delete / anonymization on request (or after N months post-delivery)
    - Privacy policy update (already has `confidentialite.html`)
    - Admin tool to purge/anonymize a customer's orders

- [ ] **Remove or secure direct Firebase config exposure in admin.js**
  - The entire config (including databaseURL) is in the bundled JS. Acceptable for Auth, less so for direct DB access.

- [ ] **Consider migrating admin dashboard to a small protected SPA or server-rendered views**
  - Current: 1000+ lines of inline + admin.js DOM manipulation is hard to audit and secure.
  - Long-term: reduces attack surface.

---

## P3 — Low / Future

- [ ] **Replace polling with WebSockets / Firebase listeners (properly secured) or Server-Sent Events** for order status in success page and admin.
- [ ] **Add basic fraud signals** (velocity checks on email/IP, unusual shipping countries) before creating Stripe sessions.
- [ ] **Image upload hardening**: virus/malware scan (ClamAV or GCS Malware Scanning) for admin uploads, even if currently only product images.
- [ ] **Dependency pinning + Renovate/Dependabot** for backend.
- [ ] **Add a SECURITY.md** file with disclosure policy, owner contact, and known limitations.
- [ ] **Load / chaos testing** of checkout flow under concurrent load (stock race conditions).

---

## Stripe Production Migration Specific Runbook (Summary)

1. **Prep (P0)**: Lock DB rules, clean test data, test label storage fix (or accept temporary limitation).
2. **Secrets**: Update GitHub secrets with live keys + live webhook secret.
3. **Stripe Dashboard**: Add live webhook endpoint pointing to the exact Cloud Run URL.
4. **Deploy**: Run deploy (or let GitHub Action on main). Verify health reports `stripeConfigured: true` with live key prefix.
5. **Validation**:
   - Small live payment via `covestudio.fr`
   - Webhook delivered (check Cloud Run logs + order status)
   - Emails received
   - Owner can see order in admin, generate label (if fixed)
6. **Post-go-live (24-48h)**: Monitor Stripe dashboard, Cloud Logging for webhook errors, failed payments. Have rollback plan (switch secrets back to test if disaster).
7. **Customer comms**: Update any "test mode" language if present (FAQ already correctly says Stripe is PCI Level 1).

---

## Quick Reference — Files to Touch for Most Fixes

| Area                        | Key Files |
|-----------------------------|-----------|
| Stripe keys / webhook       | `backend/src/routes/checkout.js`, `webhooks.js`, GitHub secrets, Stripe Dashboard |
| Stock / promo race          | `backend/src/routes/checkout.js:181`, `store.js` (updateProductStock, incrementPromo...) |
| Admin auth / Firebase leak  | `js/admin.js:36-98`, `backend/src/middleware/auth.js`, Firebase Console → Rules |
| Label persistence           | `backend/src/routes/admin.js:231` (generate + serve), `utils/colissimo.js` |
| Emails escaping             | `backend/src/utils/email.js` (all send* functions) |
| Rate limits                 | `backend/server.js:45-66` (add more) |
| Deps cleanup                | `backend/package.json`, root `package.json` |
| DB rules                    | Firebase Console (no file in repo) |

---

**Next Steps Recommendation**: Treat P0 items as a single focused "Stripe Production Hardening" ticket. Do not flip the live keys until every P0 checkbox is green and a successful small live payment + refund has been executed by the owner.

**Report generated by**: Grok 4.3 security audit pass on 2026 codebase snapshot.
