# Database connections checked on 8 September 2026

Read-only evidence from the signed-in Supabase dashboard, Vercel project/environment metadata, and the deployed CRM's public browser bundle. No customer rows, credentials or database backups are included in this report. No database record or project setting was changed. The dashboard refused the attempted resume of VVE TEST before changing its state.

| Supabase project | Reference | Verified purpose and status |
|---|---|---|
| nav1dzr's Project | `temlphabsqukkiqmrvhl` | Healthy. The live CRM browser connects here. The website's production `SUPABASE_URL` also names this project. The public schema contains bookings **and** invoices, invoice items/payments/events, receipts, customers, catalogue, admin and media tables. This is not a bookings-only database. |
| vve-os | `spbrstpxrimuuorkbsbo` | Healthy and in use. The public schema contains eight older `media_preview_*` tables. Its separate `vve_os` schema contains the agent system: tasks, agent sessions, AI calls, audit events, evidence, repositories and related records. It is not an empty staging project and must not be paused or repurposed for this website release. |
| VVE TEST | `xzacwohfeabpfadapcjz` | Paused. The Resume action was blocked because the owner is already at the two-active-free-project limit. Contents could not be inspected while paused. This project must be resumed and inspected before it is designated as the new isolated website/CRM test environment. |

## Deployment mapping and stale configuration

- Vercel `vve-clean-crm` serves `admin.vveclean.co.uk`, uses repository root `admin`, and deploys production from `main`.
- Vercel `vve-clean-website` serves the public VVE Clean domains from the repository root and also deploys production from `main`.
- The standard website/CRM `VITE_SUPABASE_URL` environment entries are shared by Production and Preview. They are marked sensitive and were not decrypted. The CRM's deployed browser bundle independently establishes its current public connection. Branch previews must not be assumed isolated.
- CRM `MEDIA_SUPABASE_URL` on the old `codex/media-system` preview branch points to **vve-os**. That setting does not apply to `feature/website-final-completion`. Photo/video provider settings on another old preview branch are assessed separately in the cloud connection report.
- The original checkout's local `.env` names `gwnooqvnrubisnyemcem.supabase.co`, a different reference from the deployed CRM. This local file is not evidence of the current production connection and was left untouched. Do not copy it into staging.
- The active release branch is `feature/website-final-completion`; the frozen release branch and original dirty checkout remain untouched.

## What needs attention

1. Establish a genuinely separate test database shared by the website and CRM. The existing VVE TEST project is the named candidate, subject to resuming it and checking its contents. Both currently active projects are in use; pausing either is not a safe automatic workaround for the free-plan limit.
2. Set branch-specific database variables for both preview deployments and verify the new preview-isolation checks. The website and CRM must use the same test reference, and the test deployment must not send ordinary customer notifications or collect live payments.
3. Apply the versioned schema changes to that isolated database, then exercise the actual booking, enquiry, pricebook and media APIs. Local embedded-PostgreSQL validation is complete but does not establish deployed Supabase permissions or cloud-provider readiness.
4. Keep production records, issued invoices and legacy payments intact. There is no evidence that the two active projects should be merged. The website booking/invoice database already keeps those records together.

The vve-os log overview showed permission-denied events against its private agent tables. Their caller and intention were not established by this website investigation; access-denial tests can generate the same messages. Do not remove policies or grant broader access merely to clear that error count. That system requires a separate caller-level diagnosis before any permissions change.

No paid plan was purchased, no project was paused, no database migration was applied remotely, and no production data or DNS was changed.
