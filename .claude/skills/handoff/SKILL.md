---
name: handoff
description: Prepare a rigorous owner-ready handoff report for VVE Clean engineering work without modifying repository state.
argument-hint: "[task, branch, pull request, or audience]"
disable-model-invocation: true
---

Prepare an engineering handoff for:

$ARGUMENTS

Do not modify files, create commits, stage changes, push, merge, deploy, apply migrations, change branches, create or remove worktrees, or alter remote resources during this skill.

## Repository inspection

Use read-only commands to establish the current state:

- `git status --short --branch`
- `git worktree list`
- `git branch -vv`
- `git log -5 --oneline --decorate`
- `git diff --name-status`
- `git diff --stat`

If a base branch is known, also inspect:

- `git log --oneline <base>..HEAD`
- `git diff --name-status <base>...HEAD`
- `git diff --stat <base>...HEAD`

Do not guess the base branch. Derive it from the task, branch history, pull request, or explicit user instruction. If it cannot be established safely, state that it is unknown.

If a pull request exists, use read-only GitHub inspection to report:

- pull request number and URL;
- base and head branches;
- merge status;
- review status;
- required checks;
- failed, pending, or skipped checks.

Do not create, edit, close, or merge a pull request.

## Validation evidence

Report only validation that is supported by actual command output or reliable session history.

For each validation command, include:

- command;
- working directory;
- pass, fail, warning, skipped, or not run;
- relevant counts or errors;
- whether the warning was pre-existing or introduced by this task, when known.

Do not claim that lint, type-check, tests, builds, previews, migrations, or deployments passed without evidence.

Do not rerun long validation commands unless Navid explicitly asks. Mark unverifiable results as `Not independently verified`.

## Sensitive-impact review

Explicitly report whether the work affects:

- production deployment;
- Supabase schema or migrations;
- production data;
- customer, booking, invoice, receipt, or payment records;
- Stripe test or live mode;
- secrets or environment variables;
- authentication or permissions;
- destructive actions;
- customer-facing prices, deposits, cancellations, parking terms, guarantees, or payment policies.

Creating a migration file must be reported separately from applying it.

## Required handoff format

Return the following sections:

### 1. Status

Use one of:

- Ready for owner review
- Ready with warnings
- Blocked
- In progress

Explain the status in one or two sentences.

### 2. Task summary

State what was requested and what was implemented.

### 3. Repository state

Report:

- repository path;
- current branch;
- intended base branch;
- tracking branch;
- clean or dirty working tree;
- modified and untracked files;
- other active worktrees that may matter.

### 4. Commits and changed files

List:

- commits created;
- files added, modified, renamed, or deleted;
- notable implementation areas;
- unrelated changes, if any.

### 5. Validation evidence

Provide the exact commands and results available.

Separate:

- successful checks;
- warnings;
- failures;
- checks not run;
- results not independently verified.

### 6. Security and production impact

Report every relevant sensitive system and approval boundary.

### 7. Database and migration status

State:

- whether migration files were created;
- whether any migration was applied;
- compatibility and rollback considerations;
- required deployment order.

Use `Not applicable` when no database work exists.

### 8. Pull request and preview status

Report:

- pull request URL and state;
- CI checks;
- Vercel Preview status;
- visual evidence still required;
- whether the branch is ready to merge.

### 9. Rollback

Explain how to reverse the work safely.

### 10. Pending owner decisions

List every decision or action that still requires Navid's approval.

### 11. Recommended next action

Give exactly one safest next action.

## Stop condition

Stop after presenting the handoff report.

Do not continue implementation or perform any approval-gated action.