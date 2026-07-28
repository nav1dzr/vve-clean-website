---
name: start-task
description: Safely inspect and prepare a new VVE Clean engineering task before any implementation begins.
argument-hint: "[task description or GitHub issue]"
disable-model-invocation: true
---

Start a new engineering task for:

$ARGUMENTS

Do not modify files, create commits, push, merge, deploy, apply migrations, change branches, or create/remove worktrees during this skill.

## Required inspection

1. Confirm the current repository path and active branch.
2. Run read-only Git inspection:
   - `git status --short --branch`
   - `git worktree list`
   - `git branch -vv`
   - `git log -5 --oneline --decorate`
3. Identify modified and untracked files.
4. Preserve the protected untracked paths listed in `CLAUDE.md`.
5. Check whether another agent or worktree may already own the relevant branch.
6. Determine whether the task relates to:
   - the public website;
   - Admin/CRM;
   - Supabase or migrations;
   - Stripe or payments;
   - customer data;
   - GitHub/Vercel infrastructure;
   - documentation or tests.

## Base-branch decision

State the recommended base branch and explain why.

Use these rules:

- Engineering-system and repository-infrastructure work normally starts from `origin/main`.
- Feature or bug work starts from the branch explicitly named in the task.
- If no base branch is named and the correct base is uncertain, stop and ask Navid.
- Never assume that a locally checked-out branch is the correct base.
- Never work directly on `main`.

## Risk classification

Classify the task as one of:

- Low: documentation, tests, or non-production tooling.
- Medium: customer-facing behaviour, APIs, authentication logic, invoice behaviour, or database migration files that will not be applied.
- High: production deployment, live Stripe changes, production data, secrets, permissions, destructive actions, or applying migrations.

List every human approval boundary that applies.

## Proposed execution plan

Return:

1. Task summary.
2. Recommended base branch.
3. Proposed branch name.
4. Proposed isolated worktree path.
5. Risk classification and reasons.
6. Sensitive systems involved.
7. Files or areas likely to change.
8. Validation commands that should run.
9. Expected preview or evidence.
10. Rollback approach.
11. Questions or ambiguities that must be resolved.

Keep the implementation plan to one to three focused tasks.

## Stop condition

Stop after presenting the inspection and proposed plan.

Do not create the branch or worktree and do not begin implementation until Navid explicitly approves.