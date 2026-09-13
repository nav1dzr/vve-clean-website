# CRM stability work — 13 September 2026

The audit is complete. The owner subsequently approved fixing the phone invoice-form loss, then preparing the critical financial fixes. Work remains on `feature/website-final-completion`; production has not been changed.

## Phase 1 — Invoice work survives returning to the browser

The old authentication provider temporarily unmounted protected screens whenever Supabase re-announced the same session on tab visibility. This was reproduced in an isolated real browser: a synthetic edited customer name and notes disappeared, with no document reload.

The fix keeps an already-verified same user's form mounted while checking access again. Initial login and identity changes still gate content. Denial, logout and stale verification responses cannot restore access. Verification has a bounded timeout; a network failure fails closed without deleting local draft recovery.

Invoice forms now keep unsaved edits in per-user, per-document session storage for up to 24 hours. A same-tab reload restores working details, notes, service contacts, references and unfinished numeric text. Recovery is cleared after confirmed saving, explicit discard, sign-out or access revocation. A changed server version does not silently overwrite either document: older local edits remain available as a read-only copy until explicitly discarded. Storage failure shows a useful warning.

Issue and Preview are blocked while edits are unsaved or a recovery/server conflict is unresolved, preventing the saved older invoice from being issued behind the visible edits. Draft save/issue includes the expected server timestamp. Booking/customer prefill retries retain their context and ignore superseded requests.

Validation: 21 authentication/guard tests passed; 75 focused invoice/editor/recovery/catalogue tests passed. Isolated browser verification at phone width proved the same form node survives hidden/visible, a genuine reload restores the name, notes and unfinished price `12.`, and simulated permission denial and mobile logout remove protected content and recovery copies. No live records, submissions, emails or payments were involved.

Limits: this is same-tab recovery, not server autosave or cross-device synchronisation. Safari can remove browser storage; physical iPhone app-switch/copy/paste testing is still required before release. The existing invoice-form Fast Refresh lint warning is unrelated to production behaviour.

## Phase 2 — Critical invoice financial integrity

Being prepared and validated locally: transactional payment/reversal, atomic draft replacement, issued-item protection and revalidation of an original invoice when issuing a revision. The database migration is not applied remotely. Final validation and release-order details will be recorded before this phase is complete.

## Release boundary

No push, merge or deployment has been performed for these fixes. The completion worktree's `AGENTS.md` requires written approval for the specific release. Any release must verify its exact source and migration ordering in an isolated test destination first. Nothing here authorises production data edits, DNS changes, Stripe behaviour changes or changing the £30 deposit.

The wider audit remains a plan: unified booking/invoice/customer balances, receipt corrections and recovery, the bank-deposit confirmation path, media publishing, staff permissions and mobile navigation are not all completed by this stability work.
