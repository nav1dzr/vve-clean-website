# Google Ads release package — 8 September 2026

## Prepared, validated locally, awaiting website release

The Ads agent folder is not a Git repository. Its existing scripts use exact plan IDs, source checksums, separate approval receipts, Google validate-only calls and protected-state readbacks. This phase follows that package format and adds only dated proposal files plus an offline validator. It does not edit old approved plans, receipts or reports.

Package: `D:/VVE_Google_Ads_Agent_Starter/vve-google-ads-agent-starter/generated/vve_20260908_website_release/`

- `plan.json`: immutable pending proposal, exact scope and release gates.
- `staging-operations.json`: five Google Ads operation payloads, `validateOnly=true`, `partialFailure=false`.
- `SHA256.json`: checksums binding the plan and operations.
- `copy-preview.md`: all 45 headlines, 12 descriptions and price-extension entries, with character counts.
- `validation-result.json`: actual local validation and explicit outstanding checks.
- Validator: `scripts/validate_vve_20260908_website_release.py` in the Ads agent folder. It has no Google client, credentials, network operations or live-apply flag.

## The exact corrections

| Existing mismatch | Prepared replacement |
|---|---|
| Carpet extension says “2 Room” for £85 | “Two bedrooms”, from £100. The website still has an £85 minimum; two bedroom items total £100. |
| Sofa extension says two-seater £65 | Standalone two-seater visit from £85. The copy explicitly distinguishes its £70 item price and £85 order minimum. |
| Studio “agency check” extension says £199 | Complete EOT studio from £220; the narrower Tailored package is not described as Complete. |
| Ads imply the customer books immediately with an online £30 deposit | Free request first; agree scope, final price and date; then pay £30 to confirm, deducted from the total. |
| No enabled saved-request conversion in the exported action list | Proposed “Booking Request Saved (Secondary)”, WEBPAGE/SUBMIT_LEAD_FORM, one per click, £0 assumed value, initially secondary for proof. |
| Old collateral implies fixed rug-only cleaning, DBS credentials, allergens or guaranteed drying | Replacement RSAs omit those unsupported or unsuitable claims. No rug-price offer is staged. |

Three replacement responsive search ads are prepared PAUSED: Carpet, Sofa, and EOT. The price asset is prepared unattached. A saved-request conversion action is prepared as secondary. These are five staged creation payloads; they do not enable ads, attach an asset, change a budget or modify an existing action.

## State that must remain unchanged

Saved readback completed 8 September at 00:12 BST: Residential Search enabled, Carpet/Sofa groups enabled, EOT group paused, Commercial paused. Preserve the £15/day Residential budget, Maximise Clicks and £2.50 CPC cap, campaign targeting/presence settings, locations, devices, schedules, keywords, networks and Local Services Ads. Preserve existing primary Deposit Paid and Qualified Calls actions during this staging phase. EOT requires a separate relaunch decision; correcting its creative does not re-enable it.

The evidence is the existing 7 September audit/supplemental exports and 8 September EOT pause state/result. Their four checksums are bound to the plan. No new account fetch, credentials, customer records or raw LSA messages were inspected.

## Exact integration remaining

1. Validate and release the website/CRM journey with its final published pricebook. These copy values must match the pricebook active at release; if they differ, prepare a new immutable plan.
2. Obtain a fresh read-only Search account snapshot through the existing agent; confirm resource IDs, current enabled ads, price association and protected state. Stop on drift rather than applying stale exported IDs.
3. Bind the exact reviewed plan hash to the release approval record. Use the existing Google validate-only and audit-log procedure before any staging creation; this local validator has not called Google.
4. After creating the new request action, read its actual Google tag snippet. Set `VITE_GOOGLE_ADS_REQUEST_CONVERSION_LABEL` to the full `AW-18214693277/<real label>`. **No label has been created or invented.**
5. Verify the website event only fires after a durable saved request, uses the saved UUID as `transaction_id`, respects Ads consent and sends no PII. Verify duplicate responses/retries do not create duplicate acquisition events. A CTA click or request attempt is not a saved lead.
6. Read back the staged RSAs as policy APPROVED and REVIEWED. Use a separately validated serving switch: enable/read back each Carpet/Sofa replacement before pausing its exact old ad. Keep EOT paused. Replace only the old Residential price association after reviewing its final scopes and destinations.
7. Compare all protected state after every approved phase. Keep rollback IDs and snapshots. If a price association must be rolled back, do not restore a known misleading price: show no extension until a truthful correction is ready.
8. During proof, saved requests appear under secondary/all-conversions reporting. Existing primary metrics are deliberately unchanged. Promote the chosen acquisition outcome only in a later explicit measurement decision; do not add request, deposit and completed-job counts together as independent customers. Keep Maximise Clicks until dependable qualified-outcome evidence supports another bidding strategy.

The two-day deposit window is described in the website management journey, not as one 48-hour Stripe Checkout Session in the ads. Seven-day re-clean wording is omitted from these replacement ads, so no ad policy depends on that new guarantee's rollout.

## Validation results

- Nine offline safety tests passed: reviewed package, incorrect prices, budget drift, EOT reactivation, immediately serving ads, non-validate payloads, invented labels, primary-goal changes and extra campaign operations.
- Three RSAs each have 15 headlines and four descriptions. Maximum lengths: 28/30 and 87/90 characters; display paths and price fields also pass their limits.
- Price scopes/currency and four source checksums verified.
- **Google API validation not run. Live changes: zero. New conversion action/tag: not created.**

Reproduce in the Ads folder:

```text
python -X utf8 scripts/validate_vve_20260908_website_release.py --self-test
python -X utf8 scripts/validate_vve_20260908_website_release.py
```
