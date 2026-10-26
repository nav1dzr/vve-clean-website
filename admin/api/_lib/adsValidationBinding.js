// Scope approval permits local preparation only. Execution needs a separately
// reviewed source manifest and explicit UTC window. Never open through env/body.
export const ADS_VALIDATION_BINDING = Object.freeze({
  sourceManifestSha256: null,
  executionAuthoritySha256: null,
  startsAt: null,
  endsAt: null,
});
