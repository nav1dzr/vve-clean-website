// Scope approval permits local preparation only. Execution needs a separately
// reviewed source manifest and explicit UTC window. Never open through env/body.
export const ADS_VALIDATION_BINDING = Object.freeze({
  sourceManifestSha256: '75e463099ad000224cc6349cf1d94c96e1e8f7efdca88efc69be3892dd7dbf8a',
  executionAuthoritySha256: 'ad03dec8f00d1dcc5ec6a122666ec77be4037854e88c4ddcc465ade8de082c28',
  startsAt: '2026-10-26T00:00:00.000Z',
  endsAt: '2026-10-26T00:30:00.000Z',
});
