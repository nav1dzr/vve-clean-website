// Manual review-request support.
//
// The whole point of these tests is that this feature must be incapable of
// emailing a real customer until two separate, deliberate steps have been
// taken. Everything else is secondary.

import { describe, it, expect } from 'vitest';
import {
  BLOCKED_REASON_TEXT,
  GOOGLE_REVIEW_URL,
  buildReviewRequestEmail,
  hasTrackingColumns,
  isReviewRequestEligible,
  isReviewRequestEnabled,
  reviewRequestBlockedReason,
} from '../api/_lib/reviewRequest.js';

const completedBooking = {
  status: 'completed',
  payment_status: 'paid',
  email: 'customer@example.com',
  review_request_sent_at: null,
  booking_ref: 'VVE-1234',
  full_name: 'Hannah Miller',
  service: 'End of Tenancy Cleaning',
};

describe('the feature is off unless deliberately switched on', () => {
  it('is off when the env var is unset', () => {
    expect(isReviewRequestEnabled({})).toBe(false);
  });

  it('is off for any value other than the exact string "true"', () => {
    for (const value of ['1', 'yes', 'TRUE', 'on', '', 'false']) {
      expect(isReviewRequestEnabled({ REVIEW_REQUESTS_ENABLED: value })).toBe(false);
    }
  });

  it('is on only for REVIEW_REQUESTS_ENABLED="true"', () => {
    expect(isReviewRequestEnabled({ REVIEW_REQUESTS_ENABLED: 'true' })).toBe(true);
  });

  it('stays off under test even if the env var is set', () => {
    // A stray .env or a CI variable must never let a test email a customer.
    expect(isReviewRequestEnabled({ REVIEW_REQUESTS_ENABLED: 'true', NODE_ENV: 'test' })).toBe(false);
    expect(isReviewRequestEnabled({ REVIEW_REQUESTS_ENABLED: 'true', VITEST: 'true' })).toBe(false);
  });

  it('is off in this very test run', () => {
    // Reads the real process.env — proves nothing here can send.
    expect(isReviewRequestEnabled()).toBe(false);
  });
});

describe('it degrades instead of breaking the CRM', () => {
  it('detects that the tracking columns have not been migrated', () => {
    const preMigration = { status: 'completed', payment_status: 'paid', email: 'a@b.com' };
    expect(hasTrackingColumns(preMigration)).toBe(false);
  });

  it('detects the columns once present, even when null', () => {
    expect(hasTrackingColumns(completedBooking)).toBe(true);
  });

  it('handles a missing booking without throwing', () => {
    expect(hasTrackingColumns(null)).toBe(false);
    expect(reviewRequestBlockedReason(null)).toBe('not_found');
  });
});

describe('only a genuinely completed, paid booking is eligible', () => {
  it('accepts a completed and paid booking with an email', () => {
    expect(isReviewRequestEligible(completedBooking)).toBe(true);
    expect(reviewRequestBlockedReason(completedBooking)).toBeNull();
  });

  it.each([
    ['new', 'not_completed'],
    ['confirmed', 'not_completed'],
    ['scheduled', 'not_completed'],
    ['in_progress', 'not_completed'],
    ['cancelled', 'not_completed'],
    ['no_show', 'not_completed'],
  ])('refuses status "%s"', (status, reason) => {
    expect(reviewRequestBlockedReason({ ...completedBooking, status })).toBe(reason);
  });

  it('refuses an unpaid booking', () => {
    expect(reviewRequestBlockedReason({ ...completedBooking, payment_status: 'pending_payment' }))
      .toBe('not_paid');
  });

  it('refuses a booking with no usable email', () => {
    expect(reviewRequestBlockedReason({ ...completedBooking, email: null })).toBe('no_email');
    expect(reviewRequestBlockedReason({ ...completedBooking, email: '' })).toBe('no_email');
    expect(reviewRequestBlockedReason({ ...completedBooking, email: 'not-an-email' })).toBe('no_email');
  });
});

describe('a customer cannot be asked twice', () => {
  it('refuses a booking that already has a sent timestamp', () => {
    expect(reviewRequestBlockedReason({
      ...completedBooking,
      review_request_sent_at: '2026-08-01T10:00:00Z',
    })).toBe('already_sent');
  });

  it('gives every blocked reason human-readable text for the CRM', () => {
    const reasons = ['not_found', 'not_completed', 'not_paid', 'no_email', 'already_sent',
      'feature_disabled', 'columns_missing'];
    for (const r of reasons) {
      expect(BLOCKED_REASON_TEXT[r], `${r} has no explanation`).toBeTruthy();
    }
  });
});

describe('the email itself', () => {
  const email = buildReviewRequestEmail({
    fullName: 'Hannah Miller',
    bookingRef: 'VVE-1234',
    service: 'End of Tenancy Cleaning',
  });

  it('links to the real Google review URL, not a placeholder', () => {
    expect(GOOGLE_REVIEW_URL).toBe('https://g.page/r/CYDRQCaICK7vEAE/review');
    expect(email.html).toContain(GOOGLE_REVIEW_URL);
    expect(email.text).toContain(GOOGLE_REVIEW_URL);
  });

  it('carries the branded wordmark used by the invoice emails', () => {
    expect(email.html).toContain('vve');
    expect(email.html).toContain('#1268D9');
  });

  it('addresses the customer by first name only', () => {
    expect(email.html).toContain('Hannah');
    expect(email.html).not.toContain('Hannah Miller');
  });

  it('falls back gracefully when the name is missing', () => {
    const e = buildReviewRequestEmail({ fullName: '', bookingRef: 'VVE-1' });
    expect(e.html).toContain('there');
  });

  it('offers no incentive, which would breach Google policy', () => {
    const body = `${email.html} ${email.text}`.toLowerCase();
    for (const word of ['discount', 'voucher', 'free clean', 'reward', 'prize', '% off']) {
      expect(body).not.toContain(word);
    }
  });

  it('assumes nothing about how the clean went, and offers a route to complain', () => {
    expect(email.text).toContain('We hope you were happy');
    expect(email.text).toMatch(/wasn't right/i);
    expect(email.text).toMatch(/48-hour re-clean/i);
  });

  it('always ships a plain-text alternative', () => {
    expect(email.text.length).toBeGreaterThan(100);
    expect(email.subject).toBeTruthy();
  });

  it('escapes customer-supplied values into the HTML', () => {
    const e = buildReviewRequestEmail({
      fullName: '<script>alert(1)</script>',
      bookingRef: 'VVE-<b>1</b>',
    });
    expect(e.html).not.toContain('<script>');
    expect(e.html).not.toContain('<b>1</b>');
  });
});
