# Media upload recovery — 17 November 2026

## Scope and live evidence

Owner reported failed phone uploads on `admin.vveclean.co.uk`, including the private-original-not-found message. Investigation began from production merge `e8b915b`; isolated branch `codex/media-upload-recovery-20261117`. Claude's scheduled-invoice PR #72 is not included.

Read-only CRM inspection showed one failed End-of-Tenancy JPEG and two unfinished MOV records, all dated 2 September. Searching their exact expected original prefixes in the existing private Cloudflare R2 bucket returned no objects for all three. No media records, originals, published selections or provider configuration were changed. These records require the owner to select the corresponding source file again; the application cannot recover bytes that are not present.

No recent failed record was available to establish a particular new phone attempt. Do not treat the old record's error as proof of the cause of every upload failure.

## Confirmed code defects and changes

1. **Wrong checksum when signing browser uploads.** The installed AWS SDK generated `x-amz-checksum-crc32=AAAAAA==` for an absent signing-time body. The browser subsequently supplies a nonempty file. The R2 client now uses `requestChecksumCalculation: WHEN_REQUIRED`. Signing still expires after 15 minutes and retains the immutable `If-None-Match` condition. A regression exercises the real SDK with synthetic credentials and no network request. [AWS checksum configuration](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html), [R2 checksum errors](https://developers.cloudflare.com/r2/api/error-codes/).
2. **False missing-file diagnostics.** HEAD failures and size/type mismatches were collapsed into one missing-original result. Inspection now distinguishes verified, missing, mismatch and unavailable; only a confirmed missing object receives another upload URL. Metadata checks remain strict. Originals are never overwritten to resolve a mismatch.
3. **A failed file stopped the batch.** Each file now completes or records an individual error independently, so later files still run. Failed/unstarted files stay selected and reuse their existing record IDs. Explicit cancellation stops later files. An immutable PUT conflict triggers final verification rather than a circular retry instruction.
4. **Lost completion responses and concurrent updates.** Recovery checks reuse ready/processing records. Conditional image writes preserve concurrent completion, archiving or edits. A generic transfer failure no longer replaces an existing useful storage error.
5. **Unsupported size allowance.** The Images binding accepts a maximum 20 MB input, while the UI/server accepted 40 MiB. New photos are capped conservatively at 20,000,000 bytes on both sides, with clear 20 MB wording. Existing media is retained; video limits are unchanged. [Cloudflare Images binding limits](https://developers.cloudflare.com/images/get-started/limits/).
6. **Verification timeout budget.** Original checks are bounded to five seconds and image preview preparation to ten seconds, leaving room within the existing client timeout.

## Validation and release boundary

Automated coverage includes the real presigner, missing versus inaccessible storage, metadata mismatch, photo-size boundaries, stale callbacks, duplicate retries, cancellation, batch continuation and lost responses.

- Full CRM suite: **1,600 tests passed across 118 files** (`npm test -- --reporter=dot --maxWorkers=4 --minWorkers=1`).
- TypeScript check and production build passed.
- Lint passed with zero errors and one existing Fast Refresh warning in `InvoiceItemsForm.tsx`; the build retains its existing large-chunk warning.
- `git diff --check` passed. No dependency, database, secret, payment or public-media-selection changes.
- Verification used synthetic credentials and mocked storage failure cases; it did not create new production media records. Actual phone uploads remain a post-release check, not an asserted result.

An initial highly parallel suite run hit an unrelated invoice-editor timeout while the build was also running. The final bounded-concurrency run above passed in full after the intended ready-record recovery expectation was updated.

This document describes a repository fix, not a claim that it has been deployed or tested with a new real iPhone upload. Publishing requires the owner's specific release approval. A new live upload test also requires an explicit exception for its test records. No database migration or production configuration change is required for this fix.
