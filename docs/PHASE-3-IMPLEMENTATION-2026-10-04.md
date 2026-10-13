# Phase 3 implementation — 4 October 2026

Based on accepted Phase 3 audit and `phase3-proposed-changes.patch`, against Phase 2 `b1cef24`. Work is isolated on `codex/phase3-ads-local-tracking`; the occupied website-final-completion checkout and frozen release branch are untouched.

## Delivered

- Move-in carpet add-ons now use shared exact room labels in the calculator, WhatsApp text and booking item formatter. Removed the obsolete whole-home comparison and inflated savings. The pricing engine and charge amounts are unchanged.
- Carpet crossed-out prices require a real net saving after the minimum visit charge. Discount-band nudges disclose the minimum, and Pricing shows the configured bands.
- All shared service/local/how-we-clean hero layouts show the configured £30 booking deposit explanation directly after the primary action row. The separate commercial page keeps its free-site-visit and written-agreement payment distinction.
- The EOT heading qualifier names East & North London without expanding coverage.
- Quote diagnostics use the existing guarded Google tag helper. No second GTM installation, Ads conversion label, price change, payment behaviour change or production configuration change.

## Event contract

The implementation follows the user's requested names, rather than the audit's proposed `quote_step_view` name.

| Event | Trigger | Parameters |
|---|---|---|
| `quote_started` | First edit, or validated continuation of a restored quote; once per service in the mounted calculator | `event_category: funnel`, allowlisted `service_type` |
| `quote_calculated` | Edited eligible quote displayed unchanged for 600 ms; one per distinct configuration in the mounted calculator | `service_type`, `quoted_total` in pounds, `currency: GBP`, `event_category: funnel` |
| `step_completed` | Successful forward continuation, after validation; EOT steps 1–3 then final review handoff 4; single-page calculators report step 1 at handoff | `service_type`, integer `quote_step`, `event_category: funnel` |

Initial rendering, restored totals, pricebook-only changes, invalid amounts, manual/photo-quote states and hidden/unmounted calculation timers do not produce `quote_calculated`. EOT calculates only on the review step. Backtracking does not repeat completed steps. A new visit/remount starts a new diagnostic journey; these are not deduplicated paid conversions.

The old broad `quote_start`, `quote_complete` and `booking_initiated` events retain their existing meaning for compatibility. Use **only the three new names** for the new quote funnel; do not sum old/new start events. Request and payment measurement is unchanged. No purchase is emitted by these hooks.

Service enums: carpet_upholstery, end_of_tenancy, move_in, after_builders, window, gutter, office. Manual after-builders edits may start interest but cannot report an automatic calculated price. Configuration signatures stay in memory and are never analytics parameters. No names, contact details, addresses, postcode references or private tokens are exported.

Production/private-page guards and Consent Mode remain unchanged. Local and preview hosts intentionally do not transmit Google events. Runtime tests mock the analytics destination; they are not proof of live GA4 ingestion.

## Account handoff

- Existing direct Google-tag integration is used; do not add duplicate GTM triggers for these events.
- Verify the production GA4 destination and Consent Mode settings through the separate measurement release workflow. No IDs or secrets were changed by Phase 3.
- Register event-scoped `service_type` and `quote_step`, and a `quoted_total` custom metric if needed. Quote totals are estimates, not revenue.
- Keep these diagnostics non-key-events and out of Ads bidding goals. Use the existing verified-deposit acquisition route; do not also import GA4 purchase as another primary customer.
- Explore `quote_started → quote_calculated → step_completed`; use `service_type` segments. EOT step completions 1–3 occur before its calculated review quote, so use a separate ordered EOT exploration: started → steps 1, 2, 3 → calculated → step 4. Require a saved-request event separately to measure actual submitted requests.

## Validation

- Full root suite: **146 files passed; 2,295 tests passed; 291 existing conditional Google-rating tests skipped; zero failures**. Includes the 407 audit-targeted existing checks and 32 added cases.
- New runtime group: hook tests (11), rendered calculator journeys (2), service/local layout assertions (10), plus the analytics payload/allowlist case (1) and eight accepted-patch regression cases.
- TypeScript passed. Lint: zero errors, seven existing React refresh warnings. Production build and prerender passed. `git diff --check` passed.
- Read-only built-site browser checks: EOT/carpet/sofa at 390 px; sofa/local Islington at 320 px; EOT at 1440 px. CTA and deposit note remain readable; no observed horizontal overflow. Browser error log was empty on the inspected service pages.
- The move-in two-bedroom quote displays `2 bedroom carpets + hallway`, +£100, without the old £110 saving claim.
- Evidence is saved in the external `phase3-ads-local-tracking-audit-2026-10-04` artifact folder, including full test/lint/build logs and applied mobile/desktop screenshots.

No live customer requests, notifications, payments, database writes, Ads edits, migrations, merge or production deployment were performed. Production ingestion and account-side goal configuration remain separate checks.
