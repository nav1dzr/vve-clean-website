# CRM reliability repairs — 15 October 2026

Branch: `feature/website-final-completion`. Baseline reconciled with current live code in `a2d606c`; unfinished media work preserved. Production branch for both Vercel projects was verified as `main`. This phase is a feature-branch change, not a production release.

## Reproduced and fixed

- Customer edit Retry previously entered Loading without making another request. A browser-injected 503 now recovers on Retry, saves edits, and retains them on reload.
- Standalone receipt retry previously created two receipts after a lost HTTP response. A stable request UUID now uses the existing receipt primary key, verifies the original immutable details/owner, and returns the original receipt. Changed-payload replay is rejected. Browser test RECEIPT-03 created exactly one REC-2026-000004 after insert + lost response + retry. No funds were moved.
- Booking/customer/invoice/receipt detail requests now ignore late responses from older routes and reset dependent action state.
- Customer financial history and invoice item/payment reads fail visibly when a dependent database query fails, rather than returning misleading empty/zero data.
- Paid invoice receipt lookup and receipt history have separate loading, error and retry states.
- Customer duplicate warnings survive navigation to the newly created record; no records are merged automatically.
- Dashboard dates and receipt default dates use Europe/London. Cancelled bookings no longer occupy operational Today/Upcoming/unscheduled queues; historical/financial views remain available.
- Website price search matches service names regardless of capitalisation and surrounding whitespace. No prices were changed.

## Validation and evidence boundaries

Full admin run: 1,045 passed, zero pending at the validation snapshot; TypeScript and lint passed after correcting the navigation test's type-only locator option. One pre-existing Fast Refresh lint warning remains in InvoiceItemsForm. Admin production build passed. Further small changes receive targeted checks before their own phase commit.

Real local PostgreSQL, 37 migrations, PostgREST and actual repository API handlers were used. Browser tests exercised actual forms. Auth and file storage use local adapters; external network destinations are blocked. No production records, DNS, Stripe behaviour, £30 deposit, customer communications, cloud secrets or service prices changed.

Evidence directory: `C:/Users/navid/.codex/visualizations/2026/09/08/01a080b9-7a2b-7dd1-87e3-15320ad66890/crm-gallery-audit-2026-10-15/`.
Key evidence: `customer-retry-bug.png`, `customer-retry-fixed.png`, `receipt-lost-response-before.png`, `receipt-safe-retry.png`, `local-stack/receipt-safe-retry-after.txt`, customer/invoice downstream failure JSON, dashboard before/after JSON, and admin validation logs.

This is a phase record, not a declaration that all CRM integrations have passed. Cloud authentication, email/Telegram delivery, Mux video processing and live R2 configuration are not proved by local adapters. Gallery, mobile navigation and pending-receipt refresh recovery remain in the following focused phase.
