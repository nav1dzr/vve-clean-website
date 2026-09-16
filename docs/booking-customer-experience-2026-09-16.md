# Booking email and customer-page refinement

The deposit request now asks the customer to check their cleaning list, appointment and total before paying £30 to secure the slot. Confirmation messages show the appointment and real payment summary. Customer replies go to contact@vveclean.co.uk; owner alert destinations remain configured separately.

## Customer presentation

- Website-style email header with the VVE logo and Cleaning & Property Services descriptor, including inverse colours for existing dark headers.
- Appointment date, arrival window and address presented together, followed by a readable cleaning list.
- Parking and congestion wording separated from cleaning tasks. Existing amounts are displayed, never recalculated by these helpers.
- Optional Additional details preserves custom agreement notes. Only the exact redundant legacy default paragraph is omitted from presentation.
- Total, Deposit due now and Balance after deposit on a payable unpaid offer. Paid/refunded zero rows are omitted; real payment/refund amounts remain visible on relevant states.
- The remaining balance is due on the cleaning day. Card balance availability still follows the existing completed-clean control.
- Preparation is a separate message for active appointments, below payment and change options.
- Known Complete/Tailored tenancy packages receive editable task suggestions for new drafts based on the published package descriptions. Existing drafts and sent agreements are not expanded or overwritten automatically.
- A separate optional accessNotes field is stored within the existing agreement JSON; no database schema migration is required.

## Validation

Full website and CRM lint, type checks, tests and builds passed. The full website run passed 2,004 tests with 281 skipped; CRM passed 964 with one existing todo. Subsequent payment-state, access-note, header and narrow-screen refinements passed focused regression checks. Existing fast-refresh and CRM bundle-size advisories remain.

Two unrelated route-load tests timed out under the first unrestricted concurrent run. Both passed separately, and the complete website suite passed with two workers.

Browser review used fictional details and non-payable sample bank information. Email layout was inspected at 390px and 320px, with no horizontal overflow at 320px. The private booking page was inspected at phone width. All preview writes and payments are disabled. No real customer data, requests, emails or payments were changed or sent during this refinement.

## Review and release

Local review: http://127.0.0.1:8826/ while the preview server is running.

The changes are prepared on codex/booking-customer-experience-20260916 from main 5d3466b. They are not live. This specific release needs owner approval before push, normal PR checks, merge and deployment under AGENTS.md. Existing production Stripe configuration and the £30 amount are unchanged.

Design references reviewed: [VoltAgent design collection](https://github.com/VoltAgent/awesome-design-md), [W3C content structure](https://www.w3.org/WAI/tutorials/page-structure/content/), and [Nodemailer message configuration](https://nodemailer.com/message). No external package, workflow or service was installed.
