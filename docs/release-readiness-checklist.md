# Release Readiness Checklist

This checklist captures follow-up improvements from the pre-launch security, backend, deployment, ecommerce, and UX review. It intentionally avoids secret values and exploit details.

## Priority guide

- **P0 - Launch blocker:** fix and retest before accepting public orders.
- **P1 - High priority:** fix before or immediately after launch, depending on risk and reachability.
- **P2 - Hardening:** schedule after launch, but keep tracked.

## P0 - Launch blockers

### Deployment root and public artifacts

- [ ] Deploy only built/static assets from a dedicated `dist/`, `build/`, or `public/` directory.
- [ ] Do not use the repository root as the hosting public root.
- [ ] Ensure these paths are not public: `.git/`, `.env*`, `.firebase/`, `backend/`, `tests/`, `node_modules/`, deploy scripts, service-account files, and local tooling files.
- [ ] Add explicit hosting/CDN deny rules for dot-directories and secret/config files.
- [ ] Retest that `/.git/HEAD`, `/.git/config`, `/.git/index`, and `/.env.production` return `403` or `404`.

### Credential incident response

- [ ] Rotate any token, service-account key, deployment secret, or API credential that may have been exposed through deployed artifacts.
- [ ] Audit GitHub, cloud, hosting, and CI/CD logs for unexpected access during the exposure window.
- [ ] Move long-lived deployment credentials to a secret manager or Workload Identity Federation.
- [ ] Confirm old credentials are revoked and no longer accepted.

### Checkout and payment integrity

- [ ] Make the backend the only source of truth for product prices.
- [ ] Ensure checkout does not trust client-supplied prices or stale public API values.
- [ ] Add tests proving a direct API/client manipulation cannot reduce the charged amount.
- [ ] Fail closed in production if Stripe keys, webhook secrets, or required payment configuration are missing.
- [ ] Retest that public products, cart totals, Stripe Checkout, order records, and confirmation emails all show the same amount.

### Legal ecommerce readiness

- [ ] Complete required French ecommerce legal notices before taking orders.
- [ ] Include business identity, registration/SIRET if applicable, postal address, contact email, hosting provider, terms of sale, payment terms, delivery, returns, and refund policy.
- [ ] Confirm checkout, FAQ, product pages, and legal pages agree on shipping countries, delays, return windows, and costs.

## P1 - Security and operational hardening

### CI/CD and deployment controls

- [ ] Add a production deployment approval gate.
- [ ] Run smoke checks before production deployment completes.
- [ ] Run dependency audit and tests in CI before deployment.
- [ ] Add deployment concurrency to avoid overlapping production releases.
- [ ] Add rollback instructions or an automated rollback path.
- [ ] Pin GitHub Actions to full commit SHAs, not only version tags.
- [ ] Pin container base images by digest.
- [ ] Run containers as a non-root user.
- [ ] Use `npm ci --omit=dev` for production images where applicable.

### Dependencies

- [ ] Triage all critical/high dependency advisories for reachability.
- [ ] Patch reachable critical/high issues on upload, email, auth, Firebase, checkout, and webhook paths before launch.
- [ ] Document any deferred advisories with rationale and target date.
- [ ] Add Dependabot or Renovate for dependency update PRs.

### Admin and contact data rendering

- [ ] Treat every contact/admin/customer/order field as untrusted.
- [ ] Avoid rendering untrusted data with `innerHTML`.
- [ ] Prefer DOM APIs such as `textContent` for admin dashboards.
- [ ] Strictly validate and normalize email addresses server-side.
- [ ] Add tests for stored-XSS style payloads so they render inert.

### Server-side gates and pickup/access codes

- [ ] Remove hardcoded access or pickup codes from frontend JavaScript and HTML.
- [ ] Validate pickup/access authorization server-side only.
- [ ] Require explicit production secrets for any pickup/access code; do not use public fallback defaults in production.
- [ ] Prefer expiring, one-time, or account-bound authorization over shared static codes.

### API hardening

- [ ] Keep admin, client, message, stats, and order APIs authenticated and authorization-checked.
- [ ] Narrow `Access-Control-Allow-Methods` per route instead of advertising all methods globally.
- [ ] Keep CORS restricted to expected origins.
- [ ] Avoid exposing internal readiness details from public health endpoints.
- [ ] Add anti-abuse controls to contact, waitlist, login, password reset, and checkout-adjacent endpoints.
- [ ] Ensure production error responses never expose stack traces or secrets.

## P2 - UX, accessibility, SEO, and performance

### Forms and conversion flows

- [ ] Make newsletter/waitlist forms functional or hide them until ready.
- [ ] Add clear success and error states for all forms.
- [ ] Add labels, `name` attributes, validation, and accessible error messaging.
- [ ] Confirm contact, checkout, account, and cart flows work without silent reloads or dead ends.

### Shop usability

- [ ] Make product cards link to product pages.
- [ ] Ensure quick-add controls are usable on touch/mobile, not hover-only.
- [ ] Verify cart, checkout, product pages, and confirmation states are consistent.
- [ ] Add trust messages near purchase CTAs: secure payment, delivery, returns, and support.

### Accessibility

- [ ] Add correct headings, landmarks, labels, and alt text.
- [ ] Add `aria-expanded` and keyboard handling for accordions.
- [ ] Add dialog roles, focus trap, escape handling, and labelled close buttons for modals.
- [ ] Respect `prefers-reduced-motion` by stopping or greatly reducing marquee/looping animations.
- [ ] Verify keyboard-only navigation and visible focus states.
- [ ] Check color contrast on all key text and buttons.

### SEO and release state

- [ ] Remove pre-launch client-side redirects before public launch.
- [ ] Use consistent `index`/`noindex` behavior based on release state.
- [ ] Add canonical URLs and descriptions for cart/account/product pages where appropriate.
- [ ] Add a branded 404 page with links back to collection, FAQ, and contact.
- [ ] Remove placeholder footer links and localize all navigation labels.

### Performance

- [ ] Enable Brotli or gzip compression for text assets.
- [ ] Use long-cache headers for versioned static assets.
- [ ] Add responsive image sizes and `srcset` where appropriate.
- [ ] Preload only truly critical hero assets.
- [ ] Review third-party scripts and font loading impact.
- [ ] Run Lighthouse or equivalent on mobile before launch.

## Suggested retest checklist

- [ ] Public forbidden artifact checks return `403` or `404`.
- [ ] Old rotated credentials fail when tested by the owner in the relevant provider consoles.
- [ ] Built deployment artifact contains no secrets, repo metadata, backend source, tests, or deploy scripts.
- [ ] Checkout charges the authoritative product price and cannot be reduced through client/API tampering.
- [ ] Checkout fails closed when required payment configuration is missing in production.
- [ ] Admin APIs return `401` or `403` without valid owner authorization.
- [ ] Stored user/contact input renders as text in admin views.
- [ ] Reachable critical/high dependency advisories are patched or formally risk-accepted.
- [ ] Production deploy requires approval and passes smoke checks.
- [ ] Core mobile flows complete: product view, add to cart, checkout, contact, and account access.
