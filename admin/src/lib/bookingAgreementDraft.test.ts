import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readBookingAgreementDraft, saveBookingAgreementDraft, clearBookingAgreementDraft, clearBookingAgreementDrafts,
  type BookingAgreementDraftValues,
} from './bookingAgreementDraft';

const context = { userId: 'owner-1', bookingId: 'booking-1' };
const values: BookingAgreementDraftValues = {
  service: 'End of tenancy clean', items: '2 bedrooms\nOven', scope: '', exclusions: '', accessNotes: '',
  address: '1 Sample Road', postcode: 'N15 4AA', date: '2026-11-20', time: '09:00–11:00', totalPence: 28500,
  changeReason: '', preparation: '', paymentPlan: 'after_clean', paymentWindowHours: 48,
};

describe('booking agreement draft recovery', () => {
  beforeEach(() => { window.sessionStorage.clear(); vi.useRealTimers(); });

  it('restores what was typed for the same account and booking', () => {
    expect(saveBookingAgreementDraft(context, 3, values)).toBe(true);
    const draft = readBookingAgreementDraft(context);
    expect(draft?.revision).toBe(3);
    expect(draft?.values).toEqual(values);
  });

  it('never offers one account or booking another one\'s draft', () => {
    saveBookingAgreementDraft(context, 3, values);
    expect(readBookingAgreementDraft({ ...context, userId: 'owner-2' })).toBeNull();
    expect(readBookingAgreementDraft({ ...context, bookingId: 'booking-2' })).toBeNull();
  });

  it('expires after 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T08:00:00Z'));
    saveBookingAgreementDraft(context, 3, values);
    vi.setSystemTime(new Date('2026-11-17T08:00:01Z'));
    expect(readBookingAgreementDraft(context)).toBeNull();
  });

  it('discards damaged or oversized records instead of restoring them', () => {
    const key = 'vve-booking-agreement:v1:owner-1:booking-1';
    window.sessionStorage.setItem(key, '{not json');
    expect(readBookingAgreementDraft(context)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(saveBookingAgreementDraft(context, 1, { ...values, items: 'x'.repeat(3001) })).toBe(false);
  });

  it('is removed by an explicit clear and by sign-out', () => {
    saveBookingAgreementDraft(context, 3, values);
    clearBookingAgreementDraft(context);
    expect(readBookingAgreementDraft(context)).toBeNull();
    saveBookingAgreementDraft(context, 3, values);
    clearBookingAgreementDrafts();
    expect(readBookingAgreementDraft(context)).toBeNull();
  });
});
