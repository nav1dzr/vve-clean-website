// Scope approval permits local preparation only. Execution needs a separately
// reviewed source manifest and explicit UTC window. Never open through env/body.
export const ADS_VALIDATION_BINDING = Object.freeze({
  sourceManifestSha256: '2ba07e7e51532e9c3fcc235077c26cf58a7a4491dd8f28e566b03282165cd86a',
  executionAuthoritySha256: '7d3040d525eab93f32d2161a7a6ac06d0a650f5ff37a3a40c0b4476b9a8753bf',
  startsAt: '2026-10-26T10:00:00.000Z',
  endsAt: '2026-10-26T10:30:00.000Z',
});
