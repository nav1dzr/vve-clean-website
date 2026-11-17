# Phase 1B booking payment allocation

This CRM change lets an owner apply money already received on a completed booking to its linked invoice. Open the invoice, choose **Apply existing booking payment**, check the original balance and deposit references, confirm the payment method and date, then apply the credit. A successful allocation shows the paid receipt in the invoice’s existing receipt controls. The owner can choose to send it from there.

## Eligible invoices

- One current issued GBP invoice explicitly linked to the completed booking.
- One verified balance entry that settles the full remaining invoice amount. The invoice total must match the agreed booking total. Bookings with and without a deposit are supported.
- The owner checks any deposit already applied against the original deposit reference. The review also requires confirmation that the balance entry has not already been credited.
- Refunds, multiple balance payments, competing active invoices, prior linked invoice activity (including voided invoices), prior receipts, mismatched totals and incomplete histories go to separate review.

## Transaction and recovery

The service-role-only functions in `supabase/migrations/20261103120000_booking_invoice_payment_allocations.sql` take a complete read snapshot and apply the approved credit. The write checks admin identity, locks the booking journey and related invoices, then revalidates the invoice, booking, source history and versions. One database transaction records the invoice credit, immutable source provenance, receipt record and attributed audit entries. The existing receipt workflow handles PDF generation and delivery.

The original booking payment, total received, Stripe checkout and customer communications are separate from invoice allocation. The operation UUID and unique source link prevent a retry or concurrent request from applying the same credit again. The browser preserves the original request in the current tab and can retry it after an uncertain response. Expired or damaged recovery records can look up a saved operation when the ID is available.

## Correction cases for a later phase

An allocated credit is excluded from ordinary payment reversal. Manual bank-entry corrections and refunds after allocation still need a separate reconciliation workflow with an attributed adjustment and explicit handling of issued receipts. Split and partial allocations remain review cases.

## Validation and rollout

Run the CRM typecheck, lint, build and full suite. The API and component tests cover admin access, feature gating, exact source and version checks, deliberate approval, lost-response recovery and refund holds. The disposable PostgreSQL runner verifies role restrictions, real concurrent attempts, repeat requests, stale snapshots, historical activity, atomic rollback and receipt creation. The browser preview uses sample data and a simulated response.

Apply only the named additive migration after the production database exception is explicitly approved. Keep `BOOKING_INVOICE_ALLOCATION_ENABLED` off until the migration is verified. Release through the normal GitHub checks, then enable the CRM production flag and verify the live invoice controls read-only. Existing customer records need no backfill. The feature flag provides a way to hide the action if rollout verification fails.

Phase 1A was released separately through PR #63 at merge `7264263`.
