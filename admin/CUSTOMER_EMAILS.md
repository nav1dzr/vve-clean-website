# Customer email composer

## Owner workflow

Customers → select customer → Write email in CRM.

1. Check the To address, enter a subject and paste the complete message, including greeting and sign-off.
2. Choose Simple signature for personal correspondence or Branded letter for a formal presentation.
3. Select Save draft & preview. This stores a private snapshot; it does not send anything.
4. Review the recipient, wording, amounts and terms. Tick the confirmation and select Send email.
5. The history shows the provider acceptance status. Replies arrive at contact@vveclean.co.uk in the normal mailbox.

The editor supports paragraphs, **bold**, headings, bullet lists and pipe-separated tables. It does not rewrite text, invent prices or use an AI service. Single-recipient correspondence only; no bulk mail, attachments, inbox synchronisation, open tracking or automatic follow-ups.

## Drafts and sending safety

- A working copy is scoped to the signed-in admin and customer in sessionStorage, expires for recovery after 24 hours, and clears on sign-out. Save draft & preview creates a durable server copy. Blocked browser storage does not prevent editing or saving a server draft.
- Each saved preview has an immutable recipient/body/style/HTML/plain-text snapshot. Changed content uses a new UUID. Reusing an ID for different content is rejected.
- Sending requires an authenticated admin and explicit confirmation of the saved recipient. An atomic draft-to-sending database update allows only one attempt per snapshot, including concurrent clicks and retries.
- SMTP acceptance is not delivery or proof of reading. If the result is uncertain, check sending history and the sender mailbox's Sent folder. Do not create another copy until the outcome is known. There is no automatic retry after attempting SMTP.
- The preview uses escaped content and a restricted formatter. Raw HTML is displayed as text, not executed. Recipient lists and injected email headers are rejected.
- Latest 20 saved previews/attempts are listed for each customer; history is private and includes the creating admin. No credentials appear in it.

## Release prerequisites

Production has NOT been changed by this implementation. Owner approval is required for this specific CRM release and its new private table.

1. Apply only `supabase/migrations/20261019150000_customer_correspondence.sql` to the CRM database after approval and normal backup/change review. It creates `customer_emails`; it does not modify existing customer, booking, invoice or payment rows.
2. Deploy the CRM commit after checks pass. The website does not require deployment for this change.
3. Reuse the existing Gmail mailer configuration. There are no new credentials, sending services, DNS changes, Stripe changes or booking-payment changes. Reply-To remains contact@vveclean.co.uk.
4. Verify the new route, saved previews and access controls in production. Send one approved review email to the owner's exact address only after obtaining sending approval. Confirm receipt and replies. Existing booking/invoice notification regression tests must pass.
5. Review the sending domain's SPF/DKIM/DMARC using the existing provider when checking real delivery. Template appearance alone cannot ensure inbox placement. This implementation does not modify DNS or claim those records have been verified.

If the table is not installed, correspondence reports storage unavailable; existing booking/invoice routes are unaffected. Rollback can restore the prior CRM deployment while preserving the private correspondence table and its history; do not delete data.

## Invoice address display correction

Generated invoice/receipt PDFs trim and omit empty address lines at rendering time. Structured address storage is unchanged, so a missing address line 2 cannot move the city into the wrong field. Existing issued PDFs are not automatically regenerated.

## Validation — 19 October 2026

- CRM suite: **1,261 tests passed in 93 files**, including 28 new tests.
- TypeScript passed. ESLint: no errors; one pre-existing Fast Refresh warning in InvoiceItemsForm.tsx.
- Isolated production UI build passed. Browser review at phone width confirmed the composer and quotation comparison table fit.
- `VVE-CUSTOMER-EMAIL-LOCAL-20261019`: actual API handlers + isolated local PostgreSQL/PostgREST + non-network local mail sink. Anonymous request 401; non-admin 403; HTML escaped; header injection 400; changed-content draft reuse 409; recipient mismatch 409; concurrent sends plus replay produced exactly one sink message; refresh retained acceptance status; cross-customer lookup denied.
- Database checks: RLS enabled; anon/authenticated have no read/write privileges; only server service_role reads/inserts/updates.
- Synthetic invoice rendered and inspected: no blank line between street and city; source address unchanged.
- No real email sent, no production database changed, no live deployment, no deliverability claim. Local auth/provider adapters do not prove real Gmail delivery or every email client's rendering.

Leon House quote content is deliberately outside the repository. Its 30-day payment terms and Option A five-working-day workmanship re-clean arrangement were approved for that quotation only. The review recipient was interpreted as the owner's contact@vveclean.co.uk mailbox; the company's recipient must be checked before sending.
