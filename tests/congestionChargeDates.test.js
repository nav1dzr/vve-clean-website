import { describe, expect, it } from 'vitest';
import { isCongestionChargeFreeDate } from '../shared/pricingCatalogue.js';

describe('London Christmas and New Year Congestion Charge exemption', () => {
  it.each([
    ['2026-12-24', false], ['2026-12-25', true], ['2026-12-31', true],
    ['2027-01-01', true], ['2027-01-02', false],
    ['2028-01-03', true], ['2028-01-04', false],
    ['2034-01-02', true], ['2034-01-03', false], ['', false],
  ])('%s is charge-free: %s', (date, expected) => {
    expect(isCongestionChargeFreeDate(date)).toBe(expected);
  });
});
