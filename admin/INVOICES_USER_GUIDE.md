# Invoices & Receipts — user guide

For VVE Clean admin staff using the CRM.

## Creating an invoice

**From a booking**: open the booking in **Bookings**, scroll to the
**Invoices** section, and select **+ Create invoice**. The customer's name,
email, phone, address, and the booking's service date carry over
automatically, along with one starting line item (the booking's service
name and total price) — edit or replace this line item, or add more, to
match exactly what you're actually invoicing for.

**Manually**: select **Invoices** in the top navigation, then **+ New
invoice**. Fill in the customer's name and at least one of email/phone
(required so there's somewhere to send it later), then add line items.

Every line item needs a description, quantity, and unit price. A per-line
discount is optional. You can reorder items with the ↑/↓ buttons, or remove
any item except the last one.

The summary at the bottom of the form is a **preview only** — the real
total is always recalculated by the server when you save, so it can never
drift from what actually gets stored or printed.

Select **Save draft** when ready. This does not send anything to the
customer and does not allocate a formal invoice number yet.

## Editing a draft

Reopen the invoice from the **Invoices** list — a draft shows the same
editable form you used to create it. Change anything and select **Save
changes**. You can also select **Preview PDF** at any point to see exactly
how it will look, complete with a **DRAFT** watermark so it's never
mistaken for a real, issued invoice.

A draft can be deleted entirely (**Delete draft**) as long as it's never
been issued — there's no way to accidentally lose an issued invoice this
way, since that button only exists on drafts.

## Issuing an invoice

Select **Issue invoice** on a draft. You'll be asked to confirm — issuing
is a one-way action:

- A permanent invoice number is allocated (`INV-2026-000001`, etc.) and
  never changes.
- A final PDF is generated and stored.
- **The invoice can no longer be edited directly.** If you spot a mistake
  after issuing, use **Duplicate as corrected draft** (see below) rather
  than trying to edit the original.

## Sending an invoice

Once issued, select **Send** (or **Resend**, if it's already been sent
once) and confirm the recipient email — it defaults to the customer's
email on file, but you can type a different address for this specific send
without changing what's stored against the invoice. You can add a short
personal message, which appears above the invoice summary in the email.
The invoice is only marked "sent" once the email provider actually accepts
the message — if sending fails, nothing changes and you can simply try
again.

## Recording a payment

On an issued invoice, select **Record payment**. This is always a manual
record — it never charges the customer's card, and it never touches
Stripe. Fill in:

- **Amount** — defaults to the full outstanding balance, but edit it for a
  partial payment.
- **Payment date**
- **Method** — bank transfer, card, Stripe (meaning "I know this was paid
  via Stripe, recorded here for the books" — not a new charge), cash, or
  other.
- **Reference** and an **internal note**, both optional.

The invoice's balance and status update immediately. If the payment brings
the balance to exactly zero, **a receipt is created automatically** — you
don't need to do anything else. You'll find it linked from the invoice, or
in the **Receipts** list.

If you need to correct a payment you entered by mistake, select **Reverse**
next to that payment and give a reason. The payment stays visible (struck
through, with the reversal reason shown) rather than disappearing — nothing
in the payment history is ever silently deleted.

## Voiding an invoice

Select **Void** and give a reason. The invoice's number is permanently
retired — it can never be issued again or reused for another invoice. Use
this for an invoice that should never have existed (e.g. issued to the
wrong customer entirely). For a wrong amount or wrong details on an
otherwise-legitimate invoice, use **Duplicate as corrected draft** instead
so the customer's paper trail stays sensible.

## Correcting an issued invoice

Select **Duplicate as corrected draft**. This creates a brand-new draft
with the same customer, items, and totals as the original — the original
stays exactly as it was, fully visible in its own right. Edit the new
draft as needed and issue it normally (it gets its own new invoice
number). There's no direct link back from the correction to the mistake it
fixes beyond both being visible in the customer's booking history, so use
the internal notes field to explain the correction if it's not obvious.

## Receipts

Receipts are never created manually — only automatically, once an invoice
reaches a zero balance. From the **Receipts** list or an invoice's linked
receipt, you can **Download** the PDF or **Send/Resend** it by email, the
same way as invoices.

## Searching and filtering

The **Invoices** list can be filtered by status (draft/issued/void/
cancelled), payment status, and due-date range, and searched by invoice
number, customer name, email, postcode, or the linked booking's reference.
An invoice past its due date with money still owed shows an **Overdue**
badge automatically — this is calculated live, never stored, so it's
always accurate as of right now.

## What you'll see if something isn't configured yet

If the business's bank details haven't been entered yet, invoices simply
won't show a payment-details block — no blank or broken-looking section.
If email sending isn't yet configured on this deployment, **Send** will
show a clear error rather than pretending to succeed. Neither of these
stops you from creating, issuing, or downloading invoices in the meantime.
