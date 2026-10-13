import { describe, expect, it } from 'vitest';
import { isValidBookingDate, isValidBookingEmail, isValidBookingName, todayLondonIsoDate } from '../shared/bookingRequestValidation.js';

describe('shared browser/API booking rules', () => {
  it.each(['P Munt', 'P. Munt', 'Li', '  Jane Smith  '])('accepts a usable name without requiring invented details: %s', value => {
    expect(isValidBookingName(value)).toBe(true);
  });
  it('trims an email without accepting malformed addresses or non-string values', () => {
    expect(isValidBookingEmail(' test@example.test ')).toBe(true);
    for (const value of ['test@', 'test name@example.test', null, 123]) expect(isValidBookingEmail(value)).toBe(false);
  });
  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '2026-1-01', 'not-a-date', null])('rejects invalid calendar dates: %s', value => {
    expect(isValidBookingDate(value)).toBe(false);
  });
  it('accepts leap day in a leap year', () => expect(isValidBookingDate('2028-02-29')).toBe(true));
  it.each([
    ['2026-06-15T23:30:00Z', '2026-06-16'],
    ['2026-12-15T23:30:00Z', '2026-12-15'],
    ['2026-03-29T00:30:00Z', '2026-03-29'],
    ['2026-10-25T01:30:00Z', '2026-10-25'],
  ])('uses the London calendar date at %s', (instant, expected) => {
    expect(todayLondonIsoDate(new Date(instant))).toBe(expected);
  });
});
