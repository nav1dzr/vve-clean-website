# Repository safety rules

These rules apply permanently to all work in this repository.

- Never push, merge to `main`, or deploy without Navid’s explicit written approval for that specific release.
- After approval, merge only when every required check passes.
- Never bypass branch protection, required checks, or GitHub’s normal merge process.
- After an approved merge, monitor production deployment and verify the live website.
- If deployment fails, stop and report the failure. Do not make speculative production changes.
- Never change Production data.
- Never change DNS.
- Never change Stripe behaviour.
- Never change the £30 deposit.
- Never invent prices, reviews, locations or guarantees.
- Never reset, clean, stash or discard work.
- Never commit unrelated untracked files.
- Run validation before every completed phase.
- Use focused commits.
- Push after each validated phase.

The release branch `release/vve-v2-pricing-admin` is frozen at `f6bc7b0`.
Website completion work belongs on `feature/website-final-completion`.
