import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingManualBooking, clearPendingManualBookings, readPendingManualBooking, rememberPendingManualBooking } from './pendingManualBooking';
import { clearInvoiceDraftRecoveries } from './invoiceDraftRecovery';
const input = { requestId: '123e4567-e89b-42d3-a456-426614174222', service: 'Carpet cleaning', paymentPlan: 'after_clean' as const, totalPrice: 100 };
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });
describe('manual booking recovery', () => {
  it('isolates owner and customer, preserves exact operation and refuses a changed retry', () => {
    expect(rememberPendingManualBooking('owner1', 'customer1', input)).toBe(true);
    expect(readPendingManualBooking('owner2', 'customer1')).toEqual({ status: 'none' });
    expect(readPendingManualBooking('owner1', 'customer2')).toEqual({ status: 'none' });
    expect(rememberPendingManualBooking('owner1', 'customer1', { ...input, totalPrice: 200 })).toBe(false);
    expect(readPendingManualBooking('owner1', 'customer1')).toEqual({ status: 'pending', input });
    expect(clearPendingManualBooking('owner1', 'customer1', 'different')).toBe(false);
    expect(clearPendingManualBooking('owner1', 'customer1', input.requestId)).toBe(true);
  });
  it('turns expired data into a blocking review marker and clears personal details', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    rememberPendingManualBooking('owner1', 'customer1', input);
    vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 60 * 1000);
    expect(readPendingManualBooking('owner1', 'customer1')).toEqual({ status: 'review', requestId: input.requestId });
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toContain('Carpet');
    expect(rememberPendingManualBooking('owner1', 'customer1', input)).toBe(false);
    expect(readPendingManualBooking('owner1', 'customer1')).toEqual({ status: 'review', requestId: input.requestId });
    expect(clearPendingManualBooking('owner1', 'customer1', input.requestId)).toBe(true);
  });
  it('fails closed when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    expect(readPendingManualBooking('owner1', 'customer1')).toEqual({ status: 'unavailable' });
    expect(rememberPendingManualBooking('owner1', 'customer1', input)).toBe(false);
  });
  it('clears pending customer details through the existing logout cleanup', () => {
    rememberPendingManualBooking('owner1', 'customer1', input);
    clearInvoiceDraftRecoveries();
    expect(readPendingManualBooking('owner1', 'customer1')).toEqual({ status: 'none' });
    clearPendingManualBookings();
  });
});
