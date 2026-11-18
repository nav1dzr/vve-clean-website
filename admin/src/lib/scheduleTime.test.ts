import { describe, expect, it } from 'vitest';
import { suggestSendTimes, formatUkDateTime, formatUkDate, formatUkInstant, SEND_TIME_OPTIONS, londonNow, addDays } from './scheduleTime';

describe('send time suggestions (UK time)', () => {
  it('suggests tomorrow morning when preparing an invoice at night', () => {
    // Monday 16 November 2026, 22:30 UK time.
    const suggestions = suggestSendTimes(new Date('2026-11-16T22:30:00Z'));
    expect(suggestions[0]).toEqual({ label: 'Tomorrow 08:00', date: '2026-11-17', time: '08:00' });
    expect(suggestions[1]).toEqual({ label: 'Tomorrow 09:00', date: '2026-11-17', time: '09:00' });
    expect(suggestions).toHaveLength(2);
  });

  it('suggests this morning when it is after midnight but still early', () => {
    const suggestions = suggestSendTimes(new Date('2026-11-17T00:40:00Z'));
    expect(suggestions[0]).toEqual({ label: 'Today 08:00', date: '2026-11-17', time: '08:00' });
  });

  it('also offers Monday when the next morning is at the weekend', () => {
    // Friday 20 November 2026, 21:00 UK time -> next morning is Saturday.
    const suggestions = suggestSendTimes(new Date('2026-11-20T21:00:00Z'));
    expect(suggestions[0].date).toBe('2026-11-21');
    expect(suggestions[2]).toEqual({ label: 'Monday 08:00', date: '2026-11-23', time: '08:00' });
  });

  it('uses the UK calendar day during British Summer Time', () => {
    // 23:30 UTC on 30 June is already 00:30 on 1 July in the UK.
    expect(londonNow(new Date('2027-06-30T23:30:00Z'))).toEqual({ date: '2027-07-01', minutes: 30 });
    expect(suggestSendTimes(new Date('2027-06-30T23:30:00Z'))[0]).toMatchObject({ label: 'Today 08:00', date: '2027-07-01' });
  });

  it('offers quarter-hour times from 07:00 to 20:45 only', () => {
    expect(SEND_TIME_OPTIONS[0]).toBe('07:00');
    expect(SEND_TIME_OPTIONS[SEND_TIME_OPTIONS.length - 1]).toBe('20:45');
    expect(SEND_TIME_OPTIONS).toHaveLength(56);
    expect(SEND_TIME_OPTIONS).toContain('08:15');
  });

  it('formats dates the British way', () => {
    expect(formatUkDateTime('2026-11-17', '08:00')).toBe('Tue 17 Nov, 08:00');
    expect(formatUkInstant('2027-07-01T07:00:00Z')).toMatch(/Thu 1 Jul.*08:00/);
    expect(formatUkInstant(null)).toBe('Not recorded');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(formatUkDate('2026-11-21')).toMatch(/^Sat,? 21 Nov 2026$/);
    expect(formatUkDate(null)).toBe('Not set');
  });
});
