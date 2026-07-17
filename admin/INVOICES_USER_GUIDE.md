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

## Payment options

Every invoice has its own **payment options** setting — **Bank transfer**
(the default), **Stripe payment link**, or **Both**. Choose this in the
"Payment options" section of the editor:

- **Bank transfer** shows the business's bank details on the PDF and in
  the email — but only once an owner has actually configured them (see
  `admin/INVOICES_SETUP.md`); until then, this section is simply left off
  rather than shown blank.
- **Stripe payment link** requires you to paste a real Stripe-hosted
  payment link (`buy.stripe.com` or `checkout.stripe.com` only — anything
  else, including a mistyped or suspicious URL, is rejected when you try
  to save). This shows a **"Pay securely by Stripe"** button on the PDF and
  in the email. **Important: this never charges the customer and never
  marks the invoice paid on its own** — it's just a link. Once the money
  actually arrives, you still record it yourself via **Record payment**,
  exactly as with a bank transfer.
- **Both** shows both blocks.

Whatever is chosen is frozen onto the invoice the moment you **Issue** it —
if the bank details or an admin's usual Stripe link change later, already-
issued invoices keep showing exactly what they showed at issue time.

## Service address vs. billing contact

By default the person/company you're billing is also treated as who the
work was for. If that's not the case — e.g. you did the work for a
**tenant**, but you're invoicing a **letting agency**, and the **receipt**
should go to the **landlord** — tick **"The service was for a different
person/address than the billing contact above"** in the editor and fill in
the service contact's details separately. The invoice PDF then shows a
distinct **Service address** block alongside the (billing) **Bill to**
block.

You can also set an **invoice recipient email** and a **receipt recipient
email** independently — these are just the default "send to" address for
each document type (you can still type a one-off different address when
you actually hit Send, without changing these defaults). A typical
agency/landlord scenario: bill the agency (billing contact), invoice the
tenant's address as the service address, and set the receipt recipient to
the landlord's email.

Editing a customer's own contact record later never changes what an
already-issued invoice shows — every invoice keeps its own copy of these
details at the time it was saved.

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
once) and confirm the recipient email — it defaults to the invoice's
**invoice recipient email** if you set one (e.g. an agency), otherwise the
billing contact's email on file, but you can type a different address for
this specific send without changing what's stored against the invoice. The
receipt, when auto-created, follows the same logic using the **receipt
recipient email** instead. You can add a short personal message, which
appears above the invoice summary in the email. The invoice is only marked
"sent" once the email provider actually accepts the message — if sending
fails, nothing changes and you can simply try again.

**Example — invoicing an agency, receipting a landlord**: set the billing
contact to the letting agency, tick the service-address checkbox and enter
the tenant's address as the service contact, set the receipt recipient
email to the landlord's address, and leave the invoice recipient email
blank (it'll default to the agency's own email). Issue and send as normal
— the agency gets the invoice, and once it's paid in full, the landlord
automatically gets the receipt.

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

## Customers

**Customers** is a simple contact book — separate from bookings, which
still work exactly as before. It's there so you can keep a record of
landlords, letting agents, and repeat customers, and quickly create
invoices or manual bookings for them.

### Adding a manual customer

Select **Customers → + New customer**. Fill in a name and whatever contact
details you have (email/phone/address/postcode aren't required, but you'll
want at least one to actually reach them), pick a **customer type**
(individual, landlord, letting agent, agency, or business) and a **source**
(how you found them), and save.

**Duplicate warnings**: if the email or phone exactly matches an existing
customer, or the postcode matches and the name looks similar, you'll see a
warning after saving — listing which existing record it matches and why.
The new record is saved regardless; **nothing is ever automatically
merged**, and two customers are never merged just because they share a
name. If it really is the same person, use the two records' notes to cross-
reference them, or edit one to consolidate — merging isn't an automated
feature in this version.

### Customer detail

Opening a customer shows their contact details, an **outstanding balance**
and **total paid** (calculated from their issued, non-void invoices only),
their notes, and three history lists:

- **Bookings** — matched by their email or phone against the bookings
  table. If a booking was made under a different email/phone than what's
  saved on the customer record, it won't show here automatically; there's
  no way to link them retroactively in this version beyond keeping the
  customer's contact details in sync.
- **Invoices** and **Receipts** — matched exactly, via the invoice's
  billing or service contact link, so these are always accurate regardless
  of what contact details are currently saved.

Four quick actions sit at the top: **Call** and **WhatsApp** (only enabled
if a phone number is on file), **Email** (only enabled if an email is on
file), **Create booking**, and **Create invoice**.

### Creating a manual booking from a customer

Select **Create booking** on a customer's page. This is for work arranged
by phone/WhatsApp/email that never went through the public quote and
checkout flow — fill in the service, date, and price, and it creates a
booking record you can manage from **Bookings** exactly like any other.
**This never charges a card and never touches Stripe** — it's a plain
record, with no online deposit taken (so it won't show a £30 deposit
that was never actually paid). It's clearly tagged with source
"admin_manual" so it's never confused with a real Stripe-paid booking.

### Creating an invoice from a customer

Select **Create invoice** on a customer's page. This opens a new invoice
draft with the customer's contact details prefilled as the billing contact
and linked back to that customer record — everything else (line items,
payment option, service address) works exactly as described above.

If the business's bank details haven't been entered yet, invoices simply
won't show a payment-details block — no blank or broken-looking section.
If email sending isn't yet configured on this deployment, **Send** will
show a clear error rather than pretending to succeed. Neither of these
stops you from creating, issuing, or downloading invoices in the meantime.
