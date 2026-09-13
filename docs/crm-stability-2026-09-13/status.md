# CRM fixes — ready locally for review, 13 September 2026

The phone-form fix and the audit's three critical invoice findings (F1–F3) are implemented and tested locally. **They are not live.** The wider CRM audit is not finished by this phase.

## What changed

### Keep invoice work when returning to the phone browser

The original issue was reproduced: the login service re-announced the same session when the tab became visible, and the CRM temporarily removed the invoice form. The name and notes disappeared even though the page itself had not reloaded.

The verified user's form now stays mounted while access is checked again. First login, user changes, denied access and logout remain protected; stale login responses cannot restore a signed-out session. Network errors still gate access but retain recoverable work.

Unsaved invoice work is stored separately for each user and document in the same tab for up to 24 hours. A reload can restore customer details, line items, notes, contacts and unfinished numeric text. Confirmed save, explicit discard, logout or loss of access clears it. A newer server version does not silently overwrite either copy; the older local copy is shown for review. Issue and Preview require saved, conflict-free values.

### Keep payments and invoice records consistent

- Payments and reversals lock the invoice and update the ledger, balance and audit event together. A failed step rolls the whole transaction back.
- Payment attempts have a stable reference. An unresolved attempt is retained across modal close/reopen and same-tab reload, so a safe retry reuses the same operation. It does not automatically retry or send a customer message. Review is required before discarding an uncertain attempt and entering different payment details.
- Saving an existing draft replaces its header and items together and rejects stale edits. Issued items cannot be changed through the draft path.
- Issuing a revision checks the original again under a lock. A payment or other intervening change blocks the stale revision; issuing and superseding happen together.
- Correcting a payment on a void invoice remains possible and keeps the document void. New payments on a void or superseded invoice remain blocked.

## Verification

884 tests passed across 73 files; 1 existing todo, no failures. Full CRM lint has no errors and 1 existing Fast Refresh warning. TypeScript and the isolated front-end build passed.

The actual migration passed **11 groups** against disposable in-memory PostgreSQL, covering permissions, stale versions, rollback, overpayment, retry deduplication, void reversal and revision issuance. It preserved the existing deposit and document-number format. That engine uses one connection; competing real database sessions still need a connected test.

The final built CRM passed a phone-width browser check: the same form node and entered values survived hidden/visible; a real reload restored the name, notes and unfinished price `12.`; simulated revocation and logout removed protected content and recovery data. No browser errors or foreign requests occurred. These are browser simulations, not a physical iPhone test.

Same-tab storage can be cleared by the browser. It is not cross-device or server autosave. Confirm saving before signing out.

## What happens next

1. **Prepare a separately approved connected test environment.** The two previously inspected Supabase projects are active systems, so neither should be reused for this test. This phase does not require you to buy a third project or change cloud settings yourself. Select the safe destination before connecting a preview.
2. **Test the exact migration, API and screens together.** Use synthetic invoices and concurrent sessions; contain all email delivery to a selected test inbox. Review older revision drafts because they intentionally require recreation after checking their source. Old browser tabs must reload.
3. **Try your actual phone workflow in that test version:** enter an invoice, switch to another app, copy text, return and paste; then refresh and check recovery. Check saved values before issuing. For an uncertain payment, use the same-attempt retry or review the payment history before starting another entry.
4. **Review the specific release before publishing.** Migration, API and UI need a coordinated cutover. The completion worktree's `AGENTS.md` requires written approval before a push, merge or deployment. Production data, DNS, Stripe behaviour and the £30 deposit remain untouched.

## Still outstanding from the audit

- F4: receipts must show payment reversals/corrections correctly and recover reliably when receipt creation fails after recording money.
- F5: join booking, invoice, receipt and customer balances into one consistent history.
- Complete and connect the agreed-slot, deposit request, bank verification, confirmation, changes/cancellation and final-payment journey.
- Finish media placement, phone-upload recovery, video completion, preview and hide/replace controls.
- Staff invitations/roles remain a plan, as requested. Mobile navigation and an owner attention queue also remain later work.
- New-draft creation still uses its existing multi-step create/cleanup path; this phase makes replacement of existing drafts transactional. Issued-document contact correction and a broader immutable document history are separate work.

## Saved work and evidence

Work is on `feature/website-final-completion`, from baseline `061019c`. Phone changes were saved in focused local commits `e983779` and `b8b16ba`; this handover accompanies the focused financial-fix commit. The frozen release branch remains `f6bc7b0`.

See [financial changes and rollout notes](../website-completion-2026-09-13/financial-integrity.md) and [the unapplied migration](../../supabase/migrations/20260913100000_invoice_financial_integrity.sql). Test reports and screenshots are in the task's local `vve-audit` artifact folder. No fixes from this phase have been pushed or deployed.
