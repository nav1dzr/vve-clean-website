import { describe, expect, it } from 'vitest';
import {
  getHomepageProofPairs,
  HOMEPAGE_CURATED_PROOF,
  selectDailyHomepageProof,
} from './homepageProof';

describe('homepage proof selection', () => {
  it('keeps the four approved proof pairs fixed and adds two rotating pairs', () => {
    expect(HOMEPAGE_CURATED_PROOF).toHaveLength(4);
    expect(getHomepageProofPairs(new Date('2026-08-31T12:00:00Z'))).toHaveLength(6);
  });

  it('is deterministic for a date and selects two different services', () => {
    const first = selectDailyHomepageProof('2026-08-31');
    const second = selectDailyHomepageProof('2026-08-31');

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0].service).not.toBe(first[1].service);
  });

  it('rotates over time without presenting work-in-progress as an after result', () => {
    const weeks = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 7, 1 + index));
      return selectDailyHomepageProof(date.toISOString().slice(0, 10));
    });
    const combinations = new Set(weeks.map((pairs) => pairs.map((pair) => pair.id).join('|')));

    expect(combinations.size).toBeGreaterThan(1);
    for (const pair of weeks.flat()) {
      expect(pair.label).not.toMatch(/in progress/i);
      expect(pair.afterAlt).not.toMatch(/part-way through|not yet dry/i);
    }
  });
});
