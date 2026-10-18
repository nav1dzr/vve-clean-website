# CRM gallery phase — 18 October 2026

The shared gallery now preserves service/stage metadata when captions change, prevents stale responses from replacing the current service or publication selection, and only offers publication where a public component actually consumes the position. Homepage photo positions reject video; shared gallery video positions remain available. Unsupported legacy positions retain their history and show Planned placement rather than claiming they are live.

The owner flow starts with Upload & library, offers editable caption suggestions, and groups positions into Before / after, Work photos and Videos. Replacing existing wording requires an explicit choice. Archive/restore operations show feedback.

## Verification

- Focused gallery and shared navigation run: 67 tests passed. The final media heading assertions were also rerun successfully after their wording change. TypeScript and lint passed (one existing unrelated Fast Refresh warning).
- Actual isolated API publication guard checks passed; the public gallery and carpet service page rendered the published before/after images after refresh.
- Browser checks covered photo upload, caption suggestion/custom edit, metadata persistence, archive/restore, position filters, preview/publication, public filters/lightbox and static-video playback. These used real local SQL and a local storage adapter, not Cloudflare R2 or Mux.
- Multiple-upload completion remains unverified after browser interruption. Mux processing and actual cloud delivery remain unverified. True unpublish and additional service categories are planned features, not existing working actions.

## Scope

No production data, prices, DNS, Stripe behaviour or deposit amount changed. This feature branch is for review and does not constitute a production release. Preserved unfinished caption work is included, not discarded.

Detailed evidence and coverage are in the task artifact folder `crm-gallery-audit-2026-10-15`, including `gallery-runtime-coverage.csv`, `gallery-runtime-findings.md`, `gallery-published-browser.png` and `VERIFICATION-REMAINING.md`.

