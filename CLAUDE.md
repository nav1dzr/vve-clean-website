# VVE Clean Engineering Instructions

## Project purpose

This repository contains the VVE Clean public website and Admin/CRM application.

Navid is the product owner and final approver. Agents may investigate, implement, test, and prepare evidence. Navid approves merges, production actions, payment changes, secrets, destructive actions, and other sensitive decisions.

## Architecture

- Repository root: Vite, React, and TypeScript public website.
- `admin/`: separate Vite, React, and TypeScript Admin/CRM application.
- `.github/workflows/ci.yml`: independent Root and Admin validation.
- `main`: Vercel production branch.
- Pull-request branches: Vercel Preview deployments.
- Supabase: application database and customer records.
- Stripe: deposits, payments, invoices, receipts, and payment metadata.

Do not assume this is a Next.js project.

## Human approval boundaries

Obtain Navid's explicit approval before:

- merging a pull request;
- pushing directly to `main`;
- deploying to production;
- applying a Supabase migration;
- modifying production data;
- changing Stripe configuration or live payment behaviour;
- changing secrets, environment variables, authentication, or permissions;
- deleting branches, files, records, storage objects, or infrastructure;
- running destructive Git or filesystem commands;
- changing customer-facing prices, deposits, cancellations, parking terms, guarantees, or payment policies.

Creating a migration file is not permission to apply it.

## Git and worktree safety

- Never work directly on `main`.
- Use one branch and one isolated Git worktree per agent task.
- Do not run multiple coding agents in the same worktree.
- Do not switch a branch being used by another agent.
- Fetch and inspect repository state before creating a branch.
- Base engineering-system work on `origin/main`.
- Base feature work on the branch explicitly stated in the task.
- Never use `git add .`; stage intended files explicitly.
- Do not automatically merge or deploy.
- Never use `git reset --hard`, `git clean`, force push, or destructive checkout without explicit approval.
- Before deleting a branch, prove its commit is contained in the intended target using `git merge-base --is-ancestor`.

The primary checkout may contain important untracked work. Preserve these paths unless Navid explicitly instructs otherwise:

- `.playwright-mcp/`
- `admin/scripts/`
- `docs/`
- `scripts/check-crm-readiness.mjs`

## Required engineering workflow

1. Inspect repository state and task requirements.
2. State the intended base branch and risk level.
3. Create or use an isolated worktree.
4. Make the smallest coherent change.
5. Review the complete diff.
6. Run relevant validation.
7. Stage only intended files.
8. Commit with a clear conventional commit message.
9. Push only after approval when the task requires approval.
10. Open a pull request with evidence, risks, rollback, and approval boundaries.
11. Stop for Navid's review before merge or production action.

## Root validation

Run from the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Admin validation

Run from `admin/`:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Do not claim a command passed unless it completed successfully.

Record pre-existing warnings separately from new failures. Do not hide, suppress, or casually fix unrelated warnings during focused work.

## Database and migration rules

- Inspect existing migrations and schema conventions first.
- Prefer additive and backward-compatible migrations.
- Explain migration order, compatibility, rollback, and deployment sequence.
- Do not apply migrations without Navid's explicit approval.
- Creating a migration file is not permission to apply it.
- Do not expose service-role keys, database passwords, tokens, or customer data.
- Treat customer, booking, invoice, receipt, and payment records as sensitive.
- Preserve audit history and referential integrity.

## Stripe and payment rules

- Never create charges, refunds, payment links, webhook changes, or live-mode changes without explicit approval.
- Clearly distinguish test mode from live mode.
- Verify payment state server-side.
- Do not trust client-supplied amounts, payment status, booking references, or invoice identifiers.
- Preserve idempotency and audit history.

## Application rules

- Preserve the established design unless the task requests a redesign.
- Use British English for customer-facing website and CRM content.
- Do not invent prices, availability, policies, guarantees, or business claims.
- Avoid unrelated refactors.
- Add or update tests when behaviour changes.
- Keep API validation and error handling explicit.
- Do not create unnecessary Vercel serverless functions.
- Treat accessibility, mobile behaviour, and security as acceptance criteria.

## Required handoff evidence

Report:

- branch and base branch;
- changed files;
- implementation summary;
- commands run and exact results;
- warnings and incomplete checks;
- security and production impact;
- migration status;
- preview URL or visual evidence when relevant;
- rollback method;
- whether the change is ready for owner review.

Never describe work as complete while tests, builds, previews, migrations, or approvals remain pending.