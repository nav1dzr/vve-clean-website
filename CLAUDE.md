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
