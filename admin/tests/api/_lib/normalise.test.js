import { describe, it, expect } from 'vitest';
import {
  isValidUuid,
  validateSearchQuery,
  sanitiseFreeTextFilter,
  isValidDateString,
  isValidIsoTimestamp,
  validateNote,
} from '../../../api/_lib/normalise.js';

describe('isValidUuid', () => {
  it('accepts a well-formed UUID', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('accepts uppercase UUIDs', () => {
    expect(isValidUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
  });

  it('rejects a booking reference', () => {
    expect(isValidUuid('N15NJ180726')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
  });
});

describe('validateSearchQuery', () => {
  it('rejects empty input', () => {
    expect(validateSearchQuery('').ok).toBe(false);
    expect(validateSearchQuery('   ').ok).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateSearchQuery(123).ok).toBe(false);
    expect(validateSearchQuery(null).ok).toBe(false);
  });

  it('rejects a single character that is not a UUID', () => {
    expect(validateSearchQuery('a').ok).toBe(false);
  });

  it('accepts a short postcode outward code', () => {
    const result = validateSearchQuery('N1');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('N1');
  });

  it('trims surrounding whitespace', () => {
    const result = validateSearchQuery('  Jasmine Carter  ');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('Jasmine Carter');
  });

  it('rejects overly long input', () => {
    expect(validateSearchQuery('a'.repeat(200)).ok).toBe(false);
  });

  it('accepts a full UUID', () => {
    const result = validateSearchQuery('123e4567-e89b-12d3-a456-426614174000');
    expect(result.ok).toBe(true);
  });
});

describe('sanitiseFreeTextFilter', () => {
  it('accepts a normal filter value', () => {
    expect(sanitiseFreeTextFilter('end_of_tenancy')).toBe('end_of_tenancy');
  });

  it('trims whitespace', () => {
    expect(sanitiseFreeTextFilter('  leaflet  ')).toBe('leaflet');
  });

  it('rejects empty strings', () => {
    expect(sanitiseFreeTextFilter('')).toBeNull();
    expect(sanitiseFreeTextFilter('   ')).toBeNull();
  });

  it('rejects embedded control characters', () => {
    expect(sanitiseFreeTextFilter('leaf\x00let')).toBeNull();
    expect(sanitiseFreeTextFilter('leaf\nlet')).toBeNull();
  });

  it('trims a lone trailing/leading newline rather than rejecting it', () => {
    // trim() removes edge whitespace (including \n) before the control-char
    // check runs — only embedded control characters are rejected.
    expect(sanitiseFreeTextFilter('leaflet\n')).toBe('leaflet');
  });

  it('rejects an overly long value', () => {
    expect(sanitiseFreeTextFilter('a'.repeat(200))).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(sanitiseFreeTextFilter(42)).toBeNull();
    expect(sanitiseFreeTextFilter(null)).toBeNull();
  });
});

describe('isValidIsoTimestamp', () => {
  it('accepts a valid ISO timestamp', () => {
    expect(isValidIsoTimestamp('2026-07-18T10:00:00.000Z')).toBe(true);
  });

  it('rejects malformed or missing input', () => {
    expect(isValidIsoTimestamp('not-a-timestamp')).toBe(false);
    expect(isValidIsoTimestamp('')).toBe(false);
    expect(isValidIsoTimestamp(null)).toBe(false);
    expect(isValidIsoTimestamp(undefined)).toBe(false);
  });
});

describe('validateNote', () => {
  it('trims and accepts a normal note', () => {
    const result = validateNote('  Called to confirm access.  ');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('Called to confirm access.');
  });

  it('rejects an empty or whitespace-only note', () => {
    expect(validateNote('').ok).toBe(false);
    expect(validateNote('   ').ok).toBe(false);
    expect(validateNote('\n\t ').ok).toBe(false);
  });

  it('rejects a non-string note', () => {
    expect(validateNote(null).ok).toBe(false);
    expect(validateNote(42).ok).toBe(false);
  });

  it('accepts a note right at the maximum length', () => {
    expect(validateNote('a'.repeat(2000)).ok).toBe(true);
  });

  it('rejects a note over the maximum length', () => {
    const result = validateNote('a'.repeat(2001));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/2000/);
  });
});

describe('isValidDateString', () => {
  it('accepts a well-formed date', () => {
    expect(isValidDateString('2026-07-18')).toBe(true);
  });

  it('rejects malformed dates', () => {
    expect(isValidDateString('18-07-2026')).toBe(false);
    expect(isValidDateString('2026/07/18')).toBe(false);
    expect(isValidDateString('not-a-date')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidDateString(null)).toBe(false);
    expect(isValidDateString(20260718)).toBe(false);
  });
});
