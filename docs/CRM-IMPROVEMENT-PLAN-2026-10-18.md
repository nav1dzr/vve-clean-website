# CRM improvements — plan only

Updated 18 October 2026. Based on the merged `feature/website-final-completion` worktree at `D:\VVE_WORKTREES\website-final-completion`, the current local API/component checks, and the parent audit's browser evidence. No new review emails, provider settings or production data have been changed for this plan.

## First: finish and verify current bug fixes

Keep these separate from new features: financial read-failure recovery; saved manual-booking recovery; correct customer history; latest-search result protection; media publishing target protection; usable position filters. Their individual evidence belongs in the runtime ledger. Local tests prove repository behavior, not delivery by production email, Stripe, Google, R2 or Mux.

## Recommended additions

| Priority | Addition | Owner benefit | Current position | Effort |
|---|---|---|---|---|
| P1 | **Send Google review request**, manually | Ask a finished customer for a review without composing a fresh email | A disabled helper exists, but no connected customer/booking action was found | Medium |
| P1 | Correct an incorrectly recorded manual bank booking deposit | Fix an entry mistake without concealing the original payment record | Booking-deposit recording exists; a reviewed amendment flow does not. Invoice-payment reversal is a separate feature | Medium–large; financial audit design and tests required |
| P1 | Reconcile booking balance payments with linked invoices | Avoid showing a new unpaid invoice for a job whose balance is already recorded as paid | The ledgers are separate. New and saved-draft invoice UI now warns from actual booking payment history and links to the booking; no payment is automatically applied or copied | Medium–large; explicit financial-flow design, uniqueness constraints and audit tests required |
| Completed fix | Align payment wording in new documents | Avoid conflicting payment-day wording | New invoices use “Payment is due on the cleaning day.” Saved terms and the legacy email fallback remain unchanged | Implemented and locally validated; not yet released |
| P1 | Turn an enquiry into a customer and booking draft | Avoid retyping contact details and losing the original message | Enquiries can be contacted, given a status and notes; conversion is an absent workflow, not a broken button | Medium |
| Completed fix | Protect customer edits made in two open screens | Prevent an older form silently replacing newer saved details | Conditional saved-version updates now reject stale edits; actual two-tab browser verification passed, with unsaved text retained and explicit reload | Implemented and validated on the feature branch; not yet released |
| P1 | Explicitly confirm a customer relationship | Distinguish the tenant, payer and letting agent; avoid guessing identity from a similar address or email | Bookings have no customer FK; matches are inferred. Invoice billing/service links are explicit | Medium–large; design and migration review required |
| P1 | Remove a published photo/video from a position | Take unsuitable work off the website without replacing it immediately | Replacement/history restore exists. True unpublish is not implemented | Medium |
| P1 | Clear action and delivery history | Know whether an action saved, an email was accepted, failed, or is still unknown | Several actions already have history; unify the presentation without claiming delivery from a successful request alone | Medium |
| P2 | Media setup and upload guidance | Know whether to upload a photo, a before/after pair or video, and where it will appear | Caption suggestions and positions exist; real cloud upload/delivery checks remain separate | Small–medium |
| P2 | Bulk media preparation | Caption, categorise and order a group without repeating the same work | Multi-file upload exists; bulk metadata editing is a separate feature | Medium |
| P2 | Consistent customer/contact search | Find a booking, customer or invoice and understand which type of result it is | Global search currently searches bookings; dedicated customer/invoice lists search their own records | Medium |
| P2 | A focused work queue | Keep completed jobs out of Today, Upcoming and Unscheduled without losing their history | The local dashboard shows a completed, future-dated synthetic job in Upcoming. Dashboard queries exclude cancelled jobs but not completed jobs | Small; retain Recent/history and explicitly define active operational states |
| P2 | Service filters that use the cleaning category | Find all carpet jobs even when the agreed room list differs | Booking Service currently matches the full stored service text exactly. The local browser returned one exact “Carpet cleaning” record while excluding entries with room descriptions | Medium; preserve the agreed description and filter on a normalized service identity |
| P2 | Status filters that explain the displayed workflow | Understand why “New” may show “Review details” and a confirmed job may show a pending amendment | The underlying operational status and the agreement workflow are distinct; filter labels do not fully explain that distinction | Small–medium; clarify the mapping before changing query semantics |
| P2 | Protect unsaved media edits | Avoid losing a carefully written caption when closing the editor | Closing the local metadata editor discarded unsaved text without a warning | Small; deliberate discard action and optional draft recovery |
| P2 | Helpful image-delivery failure feedback | Keep the gallery understandable if a published image cannot load | A deliberately failed local image request retained layout but showed the browser's broken-image content | Small; accessible fallback/retry without replacing genuine work with an invented result |
| P2 | Earlier duplicate-customer review | Notice an existing exact contact before creating another record | The current post-save advisory survives refresh and does not merge records. A reviewed existing-contact choice could appear before saving | Medium; allow legitimate shared contacts and never auto-merge |
| P2 | Return to the requested page after sign-in | Resume the customer or booking you opened | A signed-out deep link correctly hides customer data; valid local login then returns to the dashboard | Small; allow only safe same-site return routes |
| P2 | Consistent customer sources | Find and prefill phone or Checkatrade customers without correcting the source each time | Editing supports Checkatrade; the customer list filter lacks it, and booking-to-customer prefill defaults to website | Small; use a known source when available and keep it editable |
| P2 | Test-record filtering in operational lists | Keep test jobs out of workload views while retaining audit evidence | Measurement test markers exist; operational dashboard is not uniformly filtered by them | Small–medium; choose default with owner |
| P2 | Staff access management | Invite another person and limit financial/media access appropriately | Authentication and admin allowlist exist; a granular roles/invitation UI is not implemented | Large; separate permission design and tests |
| P3 | Calendar connection and reminders | Reduce copying confirmed jobs into the diary | Integration/provider status must be checked independently; do not infer readiness from UI alone | Separate project after current release |

## Manual Google review request: proposed experience

Place **Send review request** on a completed booking and on a customer record with a completed job. If multiple jobs exist, choose the relevant completed job first. This action must never run automatically when completing a job, recording a payment, sending an invoice, or deploying the site.

**Eligibility:** require a real completed job, a valid reviewed recipient email and the owner's deliberate action. Do not send for test/cancelled records or use an internal admin address as a substitute for a missing customer email. If no valid email is stored, explain why Send is unavailable and allow the owner to supply a reviewed address in the preview without silently changing the customer record. Check previous/in-flight requests before enabling Send. Review the existing helper's payment eligibility during implementation: a paid deposit is not proof that the final balance is paid, and the owner must choose any payment-related restriction explicitly.

1. Open a preview showing the selected customer, job, recipient email, subject and branded message. Use the shared VVE logo/“Cleaning & Property Services” header. Show a useful explanation if the customer has no email address.
2. Prefill the known email address and natural wording; allow Navid to edit the recipient, subject and message before sending. Editing the recipient must not silently overwrite the stored customer record.
3. Show a clearly labelled **Leave a Google review** button using the existing verified business review destination. The repository already defines `https://g.page/r/CYDRQCaICK7vEAE/review` in `admin/api/_lib/reviewRequest.js`; reuse it after checking it resolves to the right business. Do not create a new listing or claim new review counts.
4. Show previous requests for that job, with date, recipient and outcome. If a request was already sent, warn and require a deliberate resend choice. In-flight attempts and duplicate clicks need a server-side idempotency key, not just a disabled button.
5. Final button: **Send review request**. Provider acceptance is “Sent”; unknown delivery is “Delivery not confirmed”, with reconciliation before retry. A timeout must not invite an immediate duplicate send.
6. Replies go to the existing customer-facing contact address. Preserve the existing email sending configuration unless a separate approved change is necessary.

For phone-only customers, a separate **Copy Google review link** action would let the owner paste the public link into an existing conversation manually. Copying must not mark an email as sent or open/send a message automatically.

Keep the request neutral and available to all eligible completed customers. Do not reward reviews, request a particular star rating, or route unhappy customers away from the review link. Test names/initials, long surnames, absent email, edited recipient, mobile preview, keyboard navigation, duplicate attempts and provider failures before release.

### Existing foundations to reuse

- `admin/api/_lib/reviewRequest.js`: review URL, email builder, eligibility and feature-switch helpers. It is disabled unless explicitly configured; the helper alone is not an available sending feature.
- `admin/migrations/20260803120000_add_review_request_tracking.sql`: existing booking tracking fields; inspect actual environment before deciding whether any migration is needed.
- `admin/src/pages/BookingDetailPage.tsx`, `admin/src/pages/CustomerDetailPage.tsx`: candidate action locations.
- `admin/api/bookings/[id].js` and `admin/api/customers/[id].js`: inspect routing before adding an explicit authenticated manual action.
- `admin/api/_lib/mailer.js` and `admin/api/_lib/brandWordmark.js`: existing sending and branding foundations.

**Release boundary:** build and test the preview with local synthetic recipients first. Production provider configuration, enabling the feature and any real test email need explicit owner approval for that concrete action. Ordinary customer sends should always require the owner's deliberate final Send action. This audit does not send a review request.

## Enquiry conversion acceptance criteria

Choose an existing customer using exact contact matches or create a new one after reviewing a duplicate warning. Copy the original enquiry text into the booking's internal context, not the customer-facing cleaning scope. Create a draft booking with the owner choosing service, address, time and price. Keep the original enquiry and link it to the new records. Retrying after a network failure must recover the same draft, not create another booking. No offer, payment request or customer email is sent simply by converting.

## Customer relationship acceptance criteria

Do not silently merge customers sharing a phone/email, and do not treat a substring search as proof of identity. A future explicit link should be chosen and reviewable by the owner, distinguish billing and service contacts, preserve history and record link changes. When creating an invoice from a booking, offer a reviewed billing/service customer choice: contact snapshots alone do not create customer-history relationships. Start with correct labels/exact matching; changing the data model is a separate planned step.

## Unpublish acceptance criteria

Before removal, show every affected website location and the fallback/empty result. Retain the asset and publication history. A before/after pair should be handled as a pair. Confirm removal, persist it atomically, and verify the public page after refresh. Archiving a file is not a substitute for removing an active publication.

## Manual bank deposit correction acceptance criteria

Keep this separate from reversing an invoice payment. Show the original booking-deposit entry, require a reason, and preview the corrected received amount/reference/date and its effect on the booking balance and confirmation. Never pretend a money transfer was refunded or reversed at the bank. Preserve the original entry and add an attributed correction event; prevent duplicate submissions and concurrent corrections. Decide explicitly what customer notification, operational state and measurement adjustment are required before building. Do not alter Stripe payments, silently undo a confirmed appointment, or rewrite historical receipts. This is a planned financial workflow, not an enabled action.

## New-document payment wording

Implemented: new form defaults and the server creation fallback now say “Payment is due on the cleaning day.” Explicitly entered/saved terms are preserved. The historical email fallback remains unchanged for older documents with no saved terms. This changes no due dates, amounts, payment recording or Stripe behavior.

## Booking/invoice payment reconciliation acceptance criteria

Treat `booking_journey_payments` and `invoice_payments` as separate ledgers until a deliberate reconciliation workflow is designed. The current new/saved-draft invoice warning is an advisory only: a positive balance payment in the booking history prompts review of that payment and any refunds, and links to the booking. Unavailable history shows a neutral retry message. The warning does not claim the job is fully settled, reduce the invoice balance, prevent a draft, or create a second payment. Issued invoices and financial handlers are unchanged.

The future workflow must show the exact source payment(s), references, refunds/corrections and any existing invoice allocations before the owner chooses an outcome. Never relabel a complete balance as a deposit, record the same receipt of money twice, or silently reuse one payment on several invoices. Any allocation requires immutable source-payment identifiers, server-enforced uniqueness/idempotency, an attributed audit trail, retry/concurrency tests and reversal handling. Preserve historical issued documents and Stripe behavior. Decide explicitly how a paid cleaning record/receipt is produced when no invoice is needed. This financial reconciliation remains planned, not implemented.

Reproduction: `booking-invoice-ledger-finding.md` and `phone-only-browser-payment-db.json`. UI mitigation: `admin/src/pages/InvoiceEditorPage.tsx` and `admin/src/components/BookingBalancePaymentNotice.tsx`, with 77 passing combined invoice tests including two reopened-draft regressions. The final browser pass verified the warning and review link on both new and reopened draft invoices while the £100 amount due stayed unchanged. Evidence: `root-browser-observations-oct18-final.json`, `invoice-booking-payment-warning.png` and `invoice-draft-payment-warning.png`. This verifies the advisory only; financial reconciliation remains planned.

## Suggested implementation order

1. Finish the current fixes and their release checks before adding features.
2. Add the **manual review-request preview/action** and consistent delivery history. These save repeated work without automating who receives a message.
3. Design booking-payment/invoice reconciliation and manual bank-entry correction together. They must retain the original transaction history and prevent duplicate receipts of money.
4. Add enquiry-to-booking drafts, clearer status/service filters and the active-work queue.
5. Improve media guidance, unsaved-edit protection, image failure feedback and deliberate unpublish. Keep existing photos and publication history intact.
6. Consider staff permissions and calendar automation separately after these everyday workflows are dependable.

### Exact follow-up locations

- Active work queues: `admin/api/dashboard-summary.js` (Today/Upcoming/Unscheduled filters), `admin/src/pages/DashboardHome.tsx`.
- Service/status filter clarity: `admin/src/pages/BookingListPage.tsx`, `admin/api/bookings/index.js`, `admin/src/lib/format.ts` (do not change stored descriptions to make filters match).
- Media edit protection: `admin/src/pages/MediaManagerPage.tsx` and its metadata editor components.
- Published image fallback: `src/components/gallery/PhotoLightbox.tsx` and the gallery cards that display managed photos.

The local pricing preview, cloud upload, real email delivery and release checks remain separate evidence requirements. This plan does not turn an unverified integration into a working feature.




### Review requests for manually arranged work

Do not force the owner to recreate an old booking merely to ask an existing customer for a review. The proposed action can appear on a completed job or on a customer record where the owner explicitly confirms the work has been completed. Show the recipient and review link before Send. Missing email offers Copy Google review link, which neither sends a message nor marks one sent. This remains a planned manual feature.

### Additional state-label refinements

Terminal bookings should introduce their current state with Completed booking or Cancelled booking guidance, rather than the generic Arrange and confirm heading. Existing terminal actions are guarded; this is a wording refinement. Legacy unmanaged records also label the amount after an expected deposit as Remaining balance even if that deposit has not arrived; distinguish this projected balance from actual unpaid money without altering financial history.

### Measurement withdrawal and retained request details

The local withdrawal check disabled advertising reporting, cleared the reporting identifiers/matches and suppressed unsent events. Original request source fields, including the historical click/source values, remain. The confirmation and result text now explain that distinction. Define and review a separate retention/removal policy before changing historical request fields; this audit did not rewrite them or make Google Ads changes.

### Reconciliation rejection wording

Differentiate an already-resolved payment review from a missing reconciliation reason in admin/api/_lib/bookingJourney.js. The current combined guard safely rejects both, but its message always asks for a reason. The local current-revision repeat included a valid reason and returned 400 because the booking was already confirmed. This is a wording refinement; do not weaken state/revision guards or change payment behaviour.
