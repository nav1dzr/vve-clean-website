import { describe, it, expect } from 'vitest';
import { smartTitleCase, formatPostcodeDisplay, formatEmailDisplay } from '../../../api/_lib/textFormat.js';

describe('formatPostcodeDisplay', () => {
  it('uppercases and inserts the standard space for a lowercase postcode with no space', () => {
    expect(formatPostcodeDisplay('w23el')).toBe('W2 3EL');
  });

  it('normalises a postcode already typed without a space in a different case', () => {
    expect(formatPostcodeDisplay('nw37aj')).toBe('NW3 7AJ');
  });

  it('re-normalises spacing even when a space is already present', () => {
    expect(formatPostcodeDisplay('n15  2ng')).toBe('N15 2NG');
  });

  it('passes through null/empty unchanged', () => {
    expect(formatPostcodeDisplay(null)).toBe(null);
    expect(formatPostcodeDisplay('')).toBe('');
  });
});

describe('formatEmailDisplay', () => {
  it('lowercases and trims an email regardless of case', () => {
    expect(formatEmailDisplay('  JaNe@ExAmple.COM ')).toBe('jane@example.com');
  });

  it('passes through null/empty unchanged', () => {
    expect(formatEmailDisplay(null)).toBe(null);
  });
});

describe('smartTitleCase', () => {
  it('title-cases an all-lowercase name', () => {
    expect(smartTitleCase('ali')).toBe('Ali');
    expect(smartTitleCase('jane doe')).toBe('Jane Doe');
  });

  it('title-cases an all-uppercase name', () => {
    expect(smartTitleCase('JANE DOE')).toBe('Jane Doe');
  });

  it('capitalises correctly after an apostrophe', () => {
    expect(smartTitleCase("o'connor")).toBe("O'Connor");
  });

  it('capitalises correctly after a hyphen', () => {
    expect(smartTitleCase('smith-jones')).toBe('Smith-Jones');
  });

  it('preserves a deliberately mixed-case value untouched', () => {
    expect(smartTitleCase('McDonald')).toBe('McDonald');
    expect(smartTitleCase('VVE Limited')).toBe('VVE Limited');
    expect(smartTitleCase('Jane Doe')).toBe('Jane Doe');
  });

  it('title-cases an all-lowercase address while leaving numbers alone', () => {
    expect(smartTitleCase('8 kellett house')).toBe('8 Kellett House');
  });

  it('does not re-case a token containing a digit (e.g. a postcode fragment in an address line)', () => {
    expect(smartTitleCase('flat 2b')).toBe('Flat 2b');
  });

  it('preserves recognised uppercase abbreviations when the rest of the value is converted', () => {
    expect(smartTitleCase('london uk')).toBe('London UK');
  });

  it('passes through null/empty unchanged', () => {
    expect(smartTitleCase(null)).toBe(null);
    expect(smartTitleCase('')).toBe('');
  });

  it('leaves a value containing markup-like characters completely untouched, even if all-lowercase', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    expect(smartTitleCase(malicious)).toBe(malicious);
  });
});
