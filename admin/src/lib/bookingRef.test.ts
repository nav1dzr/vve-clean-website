import { describe, it, expect } from 'vitest';
import { buildBookingRefBase } from './bookingRef';

describe('buildBookingRefBase', () => {
  it('builds a POSTCODE+DDMMYY reference from a postcode and service date', () => {
    expect(buildBookingRefBase('N15 2NG', '2026-07-24')).toBe('N152NG240726');
  });

  it('uppercases and strips spaces from the postcode', () => {
    expect(buildBookingRefBase('w2 3el', '2026-07-24')).toBe('W23EL240726');
  });

  it('returns null when the postcode is missing', () => {
    expect(buildBookingRefBase('', '2026-07-24')).toBe(null);
    expect(buildBookingRefBase(null, '2026-07-24')).toBe(null);
  });

  it('falls back to today when no date is given', () => {
    expect(buildBookingRefBase('N15 2NG', null)).not.toBe(null);
  });

  it('returns null for an invalid date string', () => {
    expect(buildBookingRefBase('N15 2NG', 'not-a-date')).toBe(null);
  });
});
