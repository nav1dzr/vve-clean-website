import { describe, expect, it } from 'vitest';
import { availableBookingWindows, isValidOptionalVisitDate, todayLondonIsoDate } from '../shared/bookingRequestValidation.js';

const morning = 'Morning (8am–12pm)';
const afternoon = 'Afternoon (12pm–5pm)';
const flexible = 'Flexible';
describe('London booking dates and arrival windows', () => {
  it.each([
    ['2027-03-28T10:59:59Z', '2027-03-28', [morning, afternoon, flexible]],
    ['2027-03-28T11:00:00Z', '2027-03-28', [afternoon, flexible]],
    ['2027-03-28T15:59:59Z', '2027-03-28', [afternoon, flexible]],
    ['2027-03-28T16:00:00Z', '2027-03-28', [flexible]],
    ['2027-10-31T11:59:59Z', '2027-10-31', [morning, afternoon, flexible]],
    ['2027-10-31T12:00:00Z', '2027-10-31', [afternoon, flexible]],
    ['2027-10-31T17:00:00Z', '2027-10-31', [flexible]],
    ['2027-10-31T20:00:00Z', '2027-11-01', [morning, afternoon, flexible]],
    ['2027-07-04T23:00:00Z', '2027-07-05', [morning, afternoon, flexible]],
    ['2027-07-04T23:00:00Z', '2027-07-04', []],
  ])('shows only remaining windows at %s for %s', (clock, date, windows) => {
    expect(availableBookingWindows(date, new Date(clock))).toEqual(windows);
  });

  it('accepts a flexible enquiry or a valid London date from local midnight onwards', () => {
    const now = new Date('2027-07-04T23:00:00Z');
    expect(todayLondonIsoDate(now)).toBe('2027-07-05');
    for (const value of ['', '2027-07-05', '2028-02-29']) expect(isValidOptionalVisitDate(value, now)).toBe(true);
    for (const value of ['2027-07-04', '2027-07-35', '2029-02-29', 'tomorrow', 1, null]) expect(isValidOptionalVisitDate(value, now)).toBe(false);
  });
});
