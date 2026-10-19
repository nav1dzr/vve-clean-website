import { describe, expect, it } from 'vitest';
import {
  BUILDERS_BUDGET_GUIDE, BUILDERS_LEVELS, BUILDERS_GUIDE_NOTICE,
  formatBuildersRange,
} from '../shared/afterBuildersGuide.js';
import { AFTER_BUILDERS_FROM_PRICES_P, DEPOSIT_P } from '../shared/pricingCatalogue.js';

describe('approved after-builders display guide', () => {
  it.each([
    ['flat_1_2', [[30000, 45000], [45000, 65000], [65000, 90000]]],
    ['house_3_4', [[50000, 75000], [75000, 110000], [110000, 150000]]],
    ['property_5_plus', [[80000, 120000], [120000, 180000], [180000, 250000]]],
    ['new_build', [[25000, 40000], [40000, 60000], [60000, 85000]]],
  ])('keeps every approved %s range in pence', (key, expected) => {
    const row = BUILDERS_BUDGET_GUIDE.find(item => item.key === key);
    expect(row).toBeDefined();
    expect(BUILDERS_LEVELS.map(level => [row[level.key].minP, row[level.key].maxP])).toEqual(expected);
  });

  it('shows the open upper range explicitly rather than implying a £2,500 cap', () => {
    const large = BUILDERS_BUDGET_GUIDE.find(item => item.key === 'property_5_plus');
    expect(formatBuildersRange(large.deep)).toBe('£1,800–£2,500+');
    const flat = BUILDERS_BUDGET_GUIDE.find(item => item.key === 'flat_1_2');
    expect(formatBuildersRange(flat.standard)).toBe('£450–£650');
    expect(BUILDERS_GUIDE_NOTICE).toContain('not a fixed price or checkout total');
    expect(BUILDERS_GUIDE_NOTICE).toContain('final written quote before booking');
  });

  it('does not replace historical catalogue values or the booking deposit', () => {
    expect(AFTER_BUILDERS_FROM_PRICES_P).toEqual({ small: 24900, studio: 27900, bed1: 32900, bed2: 39900, bed3: 49900, bed4: 62500 });
    expect(DEPOSIT_P).toBe(3000);
  });
});
