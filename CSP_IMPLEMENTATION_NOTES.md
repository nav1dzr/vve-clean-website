# Content-Security-Policy — deferred, not implemented

Part of `SECURITY_AUDIT_REPORT.md` finding F3. The other three headers
(`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) plus a
conservative `Permissions-Policy` were added to the public site's
`vercel.json` on branch `fix/security-audit-medium-findings`. A
Content-Security-Policy was **not** added — this document explains why, and
exactly what needs to happen to add one safely.

## Why it was deferred

A CSP is only as safe as its ability to allow every legitimate script/style/
connection this site actually needs, on the first deploy, with no browser
available in this environment to verify against. Getting it wrong doesn't
fail loudly — it silently breaks Google Ads conversion tracking or Consent
Mode, which is worse than having no CSP at all. Concretely:

1. **Multiple inline `<script>` blocks, no nonce mechanism available.**
   This is a statically-hosted SPA (Vite + `prerender.mjs`) with no
   per-request server-side HTML templating, so a CSP nonce (which must be
   freshly generated per HTTP response) isn't achievable. The only two
   options left are `'unsafe-inline'` (which defeats most of what a script-src
   CSP is for) or exact SHA-256 hashes per inline script.

2. **The inline scripts are not identical across pages**, so hash-based CSP
   needs multiple, separately-maintained hashes:
   - `index.html` (the template every Vite/React route is pre-rendered from)
     has two inline scripts: the Consent Mode `default`/`update` block and
     the `gtag('js', ...); gtag('config', ...)` block.
   - `public/confirmation.html` is a **separate, standalone static file**
     (not part of the React app) with its own near-duplicate but
     byte-different Consent Mode/gtag-init scripts (different indentation —
     confirmed via `diff`, not assumed) **plus a third, much larger inline
     script** (~300 lines) containing the actual
     `gtag("event", "conversion", ...)` call that fires the Google Ads
     conversion tracked at label `AW-18214693277/hUwdCK68gswcEJ3TuO1D` — the
     single most business-critical piece of inline JS in the whole site.
   - `public/booking.html` is another standalone static file with its own
     small inline script (legacy `?service=&price=` redirect shim).
   - Two React pages (`src/components/FAQ.tsx`, `src/pages/CommercialPage.tsx`)
     inject page-specific JSON-LD via `dangerouslySetInnerHTML` into a
     `<script type="application/ld+json">` tag. These are very likely exempt
     from `script-src` entirely (non-executable MIME type — most browsers
     don't apply script-blocking CSP checks to `application/ld+json`), but
     this needs confirming in a real browser before being relied on, not
     assumed.

   That's a minimum of **5-6 separately-computed hashes**, recomputed and
   re-verified every time any of these scripts changes by even one
   character (a hash is exact-byte-sensitive — reformatting, adding a
   comment, or a linter auto-fix would silently break the policy).

3. **Unknown exact set of Google network domains.** `gtag.js` (loaded from
   `googletagmanager.com`) makes its own follow-up network calls for
   configuration and conversion-pixel delivery to a set of Google-owned
   domains that isn't fully enumerable from this codebase (typically
   includes some combination of `googletagmanager.com`,
   `googleadservices.com`, `google.com/pagead/*`, and
   `googleads.g.doubleclick.net`, depending on account configuration and
   which Google may change without this repo's knowledge). An incomplete
   `connect-src`/`img-src` allowlist would silently drop conversion pings
   with no visible error to a developer, only a gap in Ads reporting days
   later.

4. **No browser available in this working environment** to load the built
   site with a candidate CSP in `Content-Security-Policy-Report-Only` mode
   and check the console/`securitypolicyviolation` events before switching
   it to enforcing — which is the only reliable way to validate a CSP this
   complex without guessing.

## What is confirmed safe and doesn't need CSP coverage

- **Stripe**: `BookingPage.tsx` does `window.location.href = data.checkoutUrl`
  — a full top-level page navigation to Stripe-hosted Checkout, not an
  embedded iframe or client-side Stripe.js call. CSP's `script-src`/
  `frame-src`/`connect-src` do not restrict top-level navigations, so
  **Stripe needs no CSP allowance at all** on this site's own policy.
- **Supabase**: only used server-side in `api/*.js` (service-role key) —
  confirmed in `SECURITY_AUDIT_REPORT.md` §2 that no Supabase client call
  happens from the public site's browser bundle, so `connect-src` doesn't
  need a Supabase allowance either. (The **admin** app's CSP already
  correctly allows `https://*.supabase.co` — that's a separate,
  already-shipped policy in `admin/vercel.json` and is unaffected by this.)
- **WhatsApp/tel links**: plain `<a href="https://wa.me/...">` /
  `<a href="tel:...">` — anchor navigation is never restricted by CSP.
- **Vite assets**: the built JS/CSS bundle is loaded via a normal
  `<script type="module" src="/assets/...">` / `<link rel="stylesheet">`
  tag with a same-origin, hashed filename — `script-src 'self'` and
  `style-src 'self'` cover this with no special-casing needed.
- **Google Fonts**: `index.html` (and `confirmation.html`, `booking.html`)
  load `https://fonts.googleapis.com/css2?...` as a stylesheet and that
  stylesheet in turn references `https://fonts.gstatic.com` for the actual
  font files — `style-src` needs `https://fonts.googleapis.com` and
  `font-src` needs `https://fonts.gstatic.com`. This part is straightforward
  and low-risk.

## Exact work required to implement CSP safely

1. From the **built** `dist/index.html`, `dist/confirmation.html`, and
   `dist/booking.html` (not the source files — confirm nothing is
   transformed differently at build time), extract the exact text content
   of every inline `<script>` element and compute its SHA-256 hash
   (`openssl dgst -sha256 -binary | openssl base64`, or Node's `crypto`
   module), formatted as `'sha256-<base64>'`.
2. Enumerate the exact Google domains contacted by opening the deployed
   site in a real browser with DevTools' Network tab open, with an ad
   blocker disabled, and recording every request `gtag.js` makes after page
   load and after a manual `gtag('event', 'conversion', ...)` test call —
   build the `connect-src`/`img-src` allowlist from what's actually
   observed, not guessed.
3. Deploy the candidate policy as `Content-Security-Policy-Report-Only`
   first (add it as a second header alongside, not instead of, no policy),
   let it run for a few days of real traffic, and check the browser
   console / a report-collection endpoint for any `securitypolicyviolation`
   events before switching it to the enforcing `Content-Security-Policy`
   header.
4. Specifically verify, post-switch, in a real browser: the cookie-consent
   banner still renders and its buttons still work, the Google Ads tag
   still loads (`Network` tab shows a request to `googletagmanager.com`),
   a test booking's `checkout.session.completed` still fires the
   `gtag("event", "conversion", ...)` call on `confirmation.html`, and
   Google Fonts still render (no fallback-font flash that didn't happen
   before).
5. Only then remove the temporary `Report-Only` header and keep the
   enforcing one.

## Suggested starting point (not deployed — for reference only)

```
default-src 'self';
script-src 'self' https://www.googletagmanager.com 'sha256-<hash1>' 'sha256-<hash2>' ...;
style-src 'self' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self' <google domains observed in step 2>;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Do not copy this directly into `vercel.json` — the `script-src` hash list
and `connect-src` domain list are placeholders that must come from steps 1
and 2 above, against the actual deployed build, not this document.
