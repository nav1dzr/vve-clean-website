import { describe, expect, it } from 'vitest';
import { googleRatingSourceLabel, parseGoogleRating } from './googleRatingDisplay';

const aggregate = { value: 4.8, count: 31, verifiedOn: '2026-09-15T10:00:00Z', live: true };
describe('Google aggregate validation and source wording', () => {
  it('retains only the validated public fields', () => {
    expect(parseGoogleRating({ ...aggregate, reviews: ['unrequested'], key: 'private' })).toEqual(aggregate);
  });
  it.each([null, {}, { ...aggregate, value: NaN }, { ...aggregate, value: Infinity }, { ...aggregate, value: 5.1 },
    { ...aggregate, count: 0 }, { ...aggregate, count: 1.2 }, { ...aggregate, count: Number.MAX_SAFE_INTEGER + 1 },
    { ...aggregate, live: undefined }, { ...aggregate, verifiedOn: 'tomorrow' }])('rejects unsupported content (%#)', value => {
    expect(parseGoogleRating(value)).toBeNull();
  });
  it('distinguishes an observed snapshot from an API update', () => {
    expect(googleRatingSourceLabel({ verifiedOn: '2026-09-08' })).toMatch(/^Checked 8 Sept? 2026$/);
    expect(googleRatingSourceLabel(aggregate)).toMatch(/^Updated 15 Sept? 2026$/);
    expect(googleRatingSourceLabel(null)).toBe('');
  });
});
