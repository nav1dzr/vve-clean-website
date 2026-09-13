# CRM access and media readiness — 13 September 2026

## Corrected access explanation

The preview screenshot does not establish that Navid lost admin access. The preview isolation check returns HTTP 403 before token validation or an `admin_users` lookup. The previous client mapped every 401/403 to “Access not authorised” and cleared invoice recovery, so blocked preview setup was presented as a membership rejection.

The correction adds explicit `PREVIEW_SETUP_REQUIRED` and `ADMIN_ACCESS_DENIED` codes to `/api/me`, with support for the exact older response messages. A setup-blocked preview now displays **“Preview setup required”**, explains that records/uploads are waiting for a separate test environment, and says admin access has not yet been checked. Unknown 403 responses and server/network failures stay retryable. Rejected tokens return to sign-in.

Protected content remains gated. A confirmed membership rejection, sign-out/session loss or identity change still clears invoice drafts and pending-payment recovery. A rejected `/api/me` token preserves recovery while the SDK still holds the same identified session; an SDK `SIGNED_OUT`/null session still clears it. No access check was bypassed and no role or permission was granted.

Source: `admin/api/_lib/adminAuth.js`, `admin/api/me.js`, `admin/src/auth/AuthContext.ts`, `AuthProvider.tsx` and `RequireAuth.tsx`.

An unauthenticated read of the screenshot host's `/api/me` returned a platform HTTP 302 before application JSON. No deployment protection was bypassed. The source bug and synthetic reproduction are verified; the individual remote error's cause was not freshly observed. Current environment values were not read.

## Existing CRM versus completion preview

The existing production CRM is [admin.vveclean.co.uk](https://admin.vveclean.co.uk), recorded at `main` commit `7b3a1f3`. This work did not change it. Production does not use the preview block, and earlier signed-in inspection established access worked; the current live session was not re-tested during this correction.

That production source has no `/media` route. The completion feature branch does. The 13 September deployment metadata check still showed the CRM preview at `061019c`. The later phone/financial commits `e983779`, `b8b16ba`, `a8a1606` and the access-message correction were not established as deployed at this verification point. A built preview is not yet a connected media workspace.

## Database status freshly checked on 13 September

Authenticated, read-only Supabase browser inspection showed the **VVE Clean** organisation on **Free Plan · 3 projects**:

| Project | Reference | Evidence and use |
| --- | --- | --- |
| nav1dzr's Project | `temlphabsqukkiqmrvhl` | Listed on NANO. Earlier inspection established active website/CRM data. It remains hard-denied as a staging target. |
| vve-os | `spbrstpxrimuuorkbsbo` | Listed on NANO. Earlier inspection established an active private agent schema, despite older public media tables. It remains hard-denied as a staging target. |
| VVE TEST | `xzacwohfeabpfadapcjz` | Its overview explicitly says `Project "VVE TEST" is paused`. Table/auth/storage controls are disabled. Resume is present; the displayed resumable-until date is 22 August 2027. Contents remain uninspected. |

No Resume or plan control was clicked on 13 September. The two-active-free-project capacity rejection was the **previous attempt on 8 September**, not a new failed attempt. Whether that restriction still prevents resume was not tested today. Neither active project should be paused or repurposed to remove the preview warning.

## Media connections already repaired

The [8 September cloud evidence](../website-completion-2026-09-08/cloud-connections.md) records completed corrections: seven existing media environment entries were retargeted to the completion branch's CRM preview; R2 CORS was repaired, saved and read back; and the Mux browser policy was corrected to allow its upload destination. These are not outstanding repairs.

The private R2 bucket `vve-media-originals` and worker `vve-media-preview.navidz7111.workers.dev` were observed with the expected bindings, and a missing-image request returned 404. Mux organisation **vve limited**, environment **website** (`2httc6`), and video token entries were observed. Real photo transformation, credential compatibility, upload completion, video encoding and playback are still unverified. Those provider observations are dated 8 September, not a new inspection today.

Media implementation includes service/stage classification, captions and alt descriptions, shared numbered positions and usage previews, transactional before/after publication, history/rollback, archive protection, pagination, transfer progress/cancel/retry, processing checks and click-to-play video. Mocked and isolated SQL validation is documented in [media validation](../website-completion-2026-09-08/media-validation.md). A complete deployed upload → processing → publish → website-display round trip has not been demonstrated.

## Safe next actions

1. Obtain approval to resume VVE TEST, then inspect its contents before selecting it. If the earlier capacity block remains, the owner must approve a capacity change or identify another genuinely separate test project. No plan purchase or active-project pause is an automatic workaround.
2. Obtain approval to configure that isolated project for both previews: reviewed migrations, Navid's test account/admin membership, and one selected test inbox. Live accounts and data remain untouched. The financial migration `20260913100000_invoice_financial_integrity.sql` is unchanged by this correction and remains unapplied remotely in the recorded release state.
3. Review the existing R2/Mux destinations as test resources, then set branch-specific isolation and destination markers as described in [preview configuration](../website-completion-2026-09-08/deployment-isolation-readiness.md). A marker alone does not establish isolation. Do not grant a production role or disable the guard to obtain access.
4. After a coordinated preview-only release and configuration, use a synthetic or owner-approved photo/video to check upload, processing, shared-position preview, publication, replacement and rollback. That establishes readiness to begin filling the gallery.

## Validation

- Focused authentication/isolation suite: **59 passed**.
- Full CRM suite: **73 files, 900 passed, one existing TODO**.
- Typecheck, targeted ESLint, whitespace check and standalone synthetic build passed. The existing bundle-size advisory remains.
- Built-browser checks passed at 320/390/768px. Both recovery stores survived preview/503/unknown-403/401 cases; genuine denial and sessionless access still cleared them. Six intercepted `/api/me` GETs, no protected-data requests, no foreign-host attempts and no page errors.
- Independent auth review found no blocking issue. Existing request invalidation, abort cleanup, same-user rechecks and stale/bootstrap/logout protections remain intact. Only `authenticated` renders protected children.

This phase changes the shared auth reason/UX and related tests. No invoice lifecycle/payment code, migration, cloud configuration, credential, role or production data was changed. No commit, push or deployment was performed by the access-correction subtask.
