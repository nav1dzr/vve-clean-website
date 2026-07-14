import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatCurrency,
  formatServiceDate,
  formatDateTime,
  formatPreferred,
  bookingStatusBadge,
  paymentStatusBadge,
  balanceStatusBadge,
  telHref,
  whatsappHref,
  mailtoHref,
  copyToClipboard,
} from './format';

describe('formatCurrency', () => {
  it('formats a number as GBP', () => {
    expect(formatCurrency(249)).toBe('£249');
  });

  it('never renders "£undefined" or "£NaN" — returns an honest label instead', () => {
    expect(formatCurrency(null)).toBe('Not recorded');
    expect(formatCurrency(undefined)).toBe('Not recorded');
    expect(formatCurrency(Number.NaN)).toBe('Not recorded');
    expect(formatCurrency(null)).not.toContain('undefined');
    expect(formatCurrency(null)).not.toContain('NaN');
  });

  it('formats zero correctly, distinct from "missing"', () => {
    expect(formatCurrency(0)).toBe('£0');
  });
});

describe('formatServiceDate', () => {
  it('formats a valid ISO date', () => {
    expect(formatServiceDate('2026-07-18')).toContain('2026');
  });

  it('never renders "Invalid Date" for missing or malformed input', () => {
    expect(formatServiceDate(null)).toBe('Date not structured');
    expect(formatServiceDate(undefined)).toBe('Date not structured');
    expect(formatServiceDate('')).toBe('Date not structured');
    expect(formatServiceDate('not-a-date')).toBe('Date not structured');
    expect(formatServiceDate('not-a-date')).not.toContain('Invalid');
  });
});

describe('formatDateTime', () => {
  it('formats a valid timestamp', () => {
    expect(formatDateTime('2026-07-01T10:00:00.000Z')).toContain('2026');
  });

  it('never renders "Invalid Date" for missing input', () => {
    expect(formatDateTime(null)).toBe('Not recorded');
    expect(formatDateTime('garbage')).toBe('Not recorded');
  });
});

describe('formatPreferred', () => {
  it('joins date and time when both present', () => {
    expect(formatPreferred('2026-07-18', '10:00')).toBe('2026-07-18 · 10:00');
  });

  it('handles only one of date/time', () => {
    expect(formatPreferred('2026-07-18', null)).toBe('2026-07-18');
    expect(formatPreferred(null, '10:00')).toBe('10:00');
  });

  it('returns an honest label when neither is present, never blank', () => {
    expect(formatPreferred(null, null)).toBe('Not recorded');
    expect(formatPreferred('', '')).toBe('Not recorded');
  });
});

describe('status badges', () => {
  it('never returns an empty label for a known value', () => {
    expect(bookingStatusBadge('confirmed').label).toBe('Confirmed');
    expect(paymentStatusBadge('paid').label).toBe('Paid');
    expect(balanceStatusBadge('outstanding').label).toBe('Outstanding');
  });

  it('never returns an empty badge for unknown/missing status — always an honest label', () => {
    expect(bookingStatusBadge(null).label).not.toBe('');
    expect(bookingStatusBadge(undefined).label).not.toBe('');
    expect(bookingStatusBadge('made_up_status').label).not.toBe('');
    expect(paymentStatusBadge(null).label).not.toBe('');
    expect(balanceStatusBadge(null).label).toBe('Balance unavailable');
  });
});

describe('telHref', () => {
  it('builds a tel: link stripping spaces', () => {
    expect(telHref('07123 456 789')).toBe('tel:07123456789');
  });

  it('returns null for missing phone', () => {
    expect(telHref(null)).toBeNull();
    expect(telHref('')).toBeNull();
  });
});

describe('whatsappHref', () => {
  it('converts a UK 07... number to international 44... format', () => {
    expect(whatsappHref('07123 456 789')).toBe('https://wa.me/447123456789');
  });

  it('strips a leading + from an already-international number', () => {
    expect(whatsappHref('+44 7123 456 789')).toBe('https://wa.me/447123456789');
  });

  it('treats 07... and +44... input as equivalent, producing the same link', () => {
    expect(whatsappHref('07123456789')).toBe(whatsappHref('+447123456789'));
  });

  it('returns null for missing phone', () => {
    expect(whatsappHref(null)).toBeNull();
  });
});

describe('mailtoHref', () => {
  it('builds a mailto: link', () => {
    expect(mailtoHref('jasmine@example.com')).toBe('mailto:jasmine@example.com');
  });

  it('returns null for missing/blank email', () => {
    expect(mailtoHref(null)).toBeNull();
    expect(mailtoHref('   ')).toBeNull();
  });
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on success', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await copyToClipboard('N15NJ180726')).toBe(true);
  });

  it('returns false rather than throwing when clipboard access fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await copyToClipboard('N15NJ180726')).toBe(false);
  });
});
