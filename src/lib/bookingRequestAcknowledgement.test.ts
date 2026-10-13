import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOKING_ACKNOWLEDGEMENT_KEY as KEY, BOOKING_ACKNOWLEDGEMENT_TTL as TTL, clearBookingAcknowledgement, hasBookingAcknowledgement, rememberBookingAcknowledgement } from './bookingRequestAcknowledgement';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('generic booking request acknowledgement', () => {
  it('stores only version and expiry, expires after thirty minutes, and can be cleared', () => {
    rememberBookingAcknowledgement(1000);
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({ version: 1, expires: 1000 + TTL });
    expect(hasBookingAcknowledgement(1001)).toBe(true);
    expect(hasBookingAcknowledgement(1000 + TTL)).toBe(false);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    rememberBookingAcknowledgement();
    clearBookingAcknowledgement();
    expect(hasBookingAcknowledgement()).toBe(false);
  });

  it.each(['null', '[]', '{}', '{broken', '{"version":2,"expires":10000}', '{"version":1,"expires":"10000"}'])('ignores malformed marker %s', raw => {
    sessionStorage.setItem(KEY, raw);
    expect(hasBookingAcknowledgement(1000)).toBe(false);
  });

  it('tolerates all storage operations being blocked', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Blocked'); });
    }
    expect(() => rememberBookingAcknowledgement()).not.toThrow();
    expect(hasBookingAcknowledgement()).toBe(false);
    expect(() => clearBookingAcknowledgement()).not.toThrow();
  });
});
