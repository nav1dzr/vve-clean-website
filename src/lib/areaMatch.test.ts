import { describe, it, expect } from 'vitest';
import { matchesArea } from './areaMatch';

describe('matchesArea', () => {
  it('matches a postcode that appears as a standalone token', () => {
    expect(matchesArea('Islington, N1', 'Islington', ['N1'])).toBe(true);
  });

  it('matches an area name case-insensitively', () => {
    expect(matchesArea('stratford, e15', 'Stratford', ['E15'])).toBe(true);
  });

  it('does NOT match a shorter postcode that is only a prefix of the real one (E1 vs E15)', () => {
    // Regression: a naive substring check would match 'E1' inside 'E15' and
    // wrongly pull a Stratford (E15) review/photo onto the Shoreditch (E1)
    // page. Same failure mode for N1 vs N15/N16/N17/N19 and E2 vs E20.
    expect(matchesArea('Stratford, E15', 'Shoreditch', ['E1', 'E2'])).toBe(false);
  });

  it('does NOT match N1 inside N17, N16 or N19', () => {
    expect(matchesArea('Tottenham, N17', 'Angel', ['N1'])).toBe(false);
    expect(matchesArea('Stoke Newington, N16', 'Islington', ['N1'])).toBe(false);
    expect(matchesArea('Holloway, N19', 'Islington', ['N1'])).toBe(false);
  });

  it('does NOT match E2 inside E20', () => {
    expect(matchesArea('Stratford, E20', 'Bethnal Green', ['E2'])).toBe(false);
  });

  it('returns false when location is undefined', () => {
    expect(matchesArea(undefined, 'Islington', ['N1'])).toBe(false);
  });

  it('does not throw on regex-special characters in an area name', () => {
    expect(() => matchesArea('Somewhere', 'St. Johns (Wood)', ['N1'])).not.toThrow();
  });
});
