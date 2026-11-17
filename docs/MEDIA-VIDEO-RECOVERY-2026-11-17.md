# Media video recovery — 17 November 2026

Prepared on the isolated media completion branch. No production configuration, provider account or database records were changed by this work.

## Code behaviour

- A failure preparing the private source URL happens before claiming processing, so it remains safely retryable.
- Once the create request may have reached Mux, a timeout, malformed response or ambiguous HTTP error stays pending. Repeated Complete / Check processing calls only look for the existing provider asset; they do not create another video.
- Recovery follows Mux pagination rather than searching only the newest 100 assets. Each check is bounded to 10 pages / 10 seconds to protect the route. A result not found within that bound remains pending for a later signed event or operator verification, not permission to create another asset.
- Known provider request rejection can be retried; failed media already bound to a provider asset cannot accidentally create another asset.
- Poll and webhook transitions use conditional writes. A webhook arriving before the create response cannot be downgraded. Duplicate or late notifications cannot resurrect archived items or turn ready items back into processing. No webhook changes publishing positions.
- A stale upload-failure callback cannot change a processing row back to failed and reopen the create path.
- Preparing an upload retry cannot reset a concurrently claimed, finished, archived or provider-bound item back to uploading. A stale retry returns a refresh/check message without releasing its prepared upload URL.

## Background completion configuration (not enabled)

The existing search serverless route delegates `POST /api/search?resource=media-mux-webhook` to the signature-verified handler. No additional serverless function or database migration is needed.

After release approval, configure a webhook in the **same Mux environment used by the CRM** and securely save these server-only settings:

- `MUX_WEBHOOK_SIGNING_SECRET` — the endpoint's signing secret, not an API token.
- `MUX_WEBHOOK_ENVIRONMENT_ID` — the expected provider environment identifier.
- Hosted preview only: `VVE_PREVIEW_MUX_WEBHOOK_ENVIRONMENT_ID` must explicitly match the isolated environment identifier, in addition to the existing isolated database guards.

Absent configuration returns 503 and leaves normal authenticated manual polling available. Never copy the production webhook secret into a test environment. The production provider configuration remains a separate approval/configuration step; this implementation alone does not make background processing live.

The handler accepts only timestamped HMAC-SHA256 signatures over exact raw request bytes, within five minutes. It verifies the provider environment, supported event type, media passthrough UUID and existing provider asset binding. Oversized, malformed or unauthenticated requests cannot access media rows. Storage failures return non-2xx so Mux can retry.

## Remaining operational limit

A historical timeout with no stored provider ID, no matching provider asset and no webhook cannot safely be re-created automatically: a prior request may still have been accepted. Preserve the original and verify the provider before an operator-authorised replacement. The code deliberately does not infer that a missing list result proves no previous asset exists.

## Validation

Focused tests cover uncertain handoffs, pagination, the webhook/create race, provider-ID mismatches, terminal/archived states, duplicate/out-of-order events, signature tampering/expiry, environment isolation and database failure. These are automated local tests; they are not evidence of a configured real provider webhook.

## Official references

- [Mux signature verification](https://www.mux.com/docs/core/verify-webhook-signatures)
- [Mux webhook delivery and retries](https://www.mux.com/docs/core/listen-for-webhooks)
- [Mux assets and pagination](https://www.mux.com/docs/api-reference/video/assets)
