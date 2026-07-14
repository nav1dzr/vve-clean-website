# Final Launch Checklist — VVE Clean

Everything below requires a human with browser and production/Stripe-dashboard access — none of it can be performed from this automated environment. Do these **after** `chore/final-production-audit-cleanup` is reviewed and merged, and **before** announcing the site is live.

## Pre-flight (before the real booking test)

- [ ] Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in the **admin** Vercel project's Production environment variables (flagged in `FINAL_PRODUCTION_AUDIT.md` — a missing value fails silently as a blank white screen, not a clear error).
- [ ] Confirm `STRIPE_SECRET_KEY` in the **public site** Vercel project is the **live** key (`sk_live_...`), not a test key, before the real booking test below.
- [ ] Confirm the Google Ads conversion action "Booking Deposit Paid" in the Google Ads dashboard still has tag setup matching `AW-18214693277/hUwdCK68gswcEJ3TuO1D` exactly.

## One controlled real booking test

Use a real card, a small/real service selection, and a booking reference you can identify as a test afterwards (e.g. your own name/phone). This is the only step in this checklist that spends real money and creates a real database row — do it deliberately, once.

- [ ] **Stripe**: Complete checkout with a real card. Confirm the payment appears in the Stripe Dashboard under Payments, in **live mode**, for the correct amount (£30 deposit).
- [ ] **Supabase**: Confirm a new row appears in the `bookings` table with the correct service, price, date, time, and `payment_status`. Confirm `confirmation_token` is populated but was never visible in any client-facing response during the flow.
- [ ] **Customer email**: Confirm the customer-facing confirmation email arrives, with correct booking details and honest "booking request" wording (not "confirmed" unless the CRM has already set status to confirmed).
- [ ] **Business email**: Confirm the internal business notification email arrives with correct booking details.
- [ ] **Telegram**: Confirm the Telegram notification fires (if configured) with correct booking details.
- [ ] **Google Sheets**: Confirm the booking row is appended to the tracking spreadsheet (if configured).
- [ ] **CRM booking visibility**: Log into the admin CRM and confirm the new booking appears in the dashboard/booking list, with correct customer/service/payment details, and that `confirmation_token` is NOT visible anywhere in the CRM UI.
- [ ] **Google Ads conversion**: Confirm exactly one conversion fires for this transaction (check Google Ads' conversion diagnostics or GA4 real-time view) — not zero, not duplicated on refresh.
- [ ] **Consent behaviour**: Before accepting/rejecting cookies, confirm in browser dev tools that the Ads/Analytics tags are in a denied/no-storage state; after accepting, confirm they switch to granted; refresh the page and confirm the choice persists.
- [ ] **Mobile**: Repeat the confirmation-page visual check (not full purchase) on a real mobile device — confirm no overlapping sticky bars, 44px tap targets, and the booking-request wording reads correctly.
- [ ] **Desktop**: Repeat the confirmation-page visual check on desktop.
- [ ] Use the CRM to mark the test booking's status as `confirmed`, then reload the confirmation page (if the link still works / token still valid) and confirm the wording switches to the genuinely-confirmed state ("You're all booked in!").
- [ ] Once verified, use the CRM (or Supabase directly) to clearly label this row as a test booking, or delete it, so it doesn't appear in real business reporting.

## Rollback steps

If the real booking test reveals a blocking problem after `chore/final-production-audit-cleanup` has been merged and deployed:

1. **Identify the last known-good production deployment** in the Vercel dashboard for `vve-clean-website` (Production tab, sorted by date) — this is the deployment from before this merge.
2. **Instant rollback**: In the Vercel dashboard, use "Promote to Production" on that prior deployment. This does not require a git revert and takes effect immediately (Vercel serves the prior build).
3. **Git-level rollback** (if a deploy-level rollback isn't enough, e.g. a Supabase migration also needs reverting): `git revert <merge-commit-hash>` on `main`, push, and let Vercel redeploy from the reverted `main`. Do not force-push.
4. **Admin CRM**: if the issue is admin-specific, the same two rollback options apply independently to the `vve-clean-crm` Vercel project — it deploys separately from the public site and can be rolled back without affecting the public site.
5. **Database**: this audit did not add or modify any Supabase migration, so no migration rollback should be needed as a result of this branch specifically. If a future migration needs reverting, write and test a down-migration rather than editing production data by hand.
6. After any rollback, re-run the one controlled real booking test above against the restored deployment before considering the incident closed.
