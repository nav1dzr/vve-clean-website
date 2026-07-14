import { describe, it, expect } from 'vitest';
import { CARD_SELECT, DETAIL_SELECT, toCard, toDetail } from './bookingFields.js';

describe('CARD_SELECT / DETAIL_SELECT', () => {
  it('never includes confirmation_token', () => {
    expect(CARD_SELECT).not.toMatch(/confirmation_token/);
    expect(DETAIL_SELECT).not.toMatch(/confirmation_token/);
  });
});

describe('toCard', () => {
  it('maps a full row to the safe card shape', () => {
    const row = {
      id: 'abc-123',
      booking_ref: 'N15NJ180726',
      full_name: 'Jasmine Carter',
      phone: '07123456789',
      postcode: 'N15 5NJ',
      service: 'end_of_tenancy',
      preferred_date: '2026-07-18',
      preferred_time: '10:00',
      service_date: '2026-07-18',
      status: 'confirmed',
      payment_status: 'paid',
      total_price: 249,
      created_at: '2026-07-01T00:00:00.000Z',
      // Fields that must never leak through, even if present on the row:
      confirmation_token: 'super-secret-token',
      notes: 'gate code 1234',
      address: '14 Elm Road',
    };

    const card = toCard(row);

    expect(card).toEqual({
      id: 'abc-123',
      bookingRef: 'N15NJ180726',
      fullName: 'Jasmine Carter',
      phone: '07123456789',
      postcode: 'N15 5NJ',
      service: 'end_of_tenancy',
      preferredDate: '2026-07-18',
      preferredTime: '10:00',
      serviceDate: '2026-07-18',
      status: 'confirmed',
      paymentStatus: 'paid',
      totalPrice: 249,
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    expect(card).not.toHaveProperty('confirmation_token');
    expect(card).not.toHaveProperty('notes');
    expect(card).not.toHaveProperty('address');
  });

  it('passes through null values for historical rows honestly', () => {
    const card = toCard({
      id: 'abc',
      booking_ref: 'N15NJ180726',
      full_name: 'Old Booking',
      phone: null,
      postcode: 'N15',
      service: 'window',
      preferred_date: null,
      preferred_time: null,
      service_date: null,
      status: 'new',
      payment_status: 'paid',
      total_price: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });

    expect(card.totalPrice).toBeNull();
    expect(card.serviceDate).toBeNull();
  });
});

describe('toDetail', () => {
  const baseRow = {
    id: 'abc-123',
    booking_ref: 'N15NJ180726',
    full_name: 'Jasmine Carter',
    phone: '07123456789',
    email: 'jasmine@example.com',
    address: '14 Elm Road',
    postcode: 'N15 5NJ',
    service: 'end_of_tenancy',
    quote_config: null,
    preferred_date: '2026-07-18',
    preferred_time: '10:00',
    service_date: '2026-07-18',
    notes: 'Parking round the back',
    total_price: 249,
    deposit_amount: 30,
    payment_status: 'paid',
    balance_status: 'outstanding',
    balance_paid_at: null,
    balance_payment_method: null,
    status: 'confirmed',
    stripe_session_id: 'cs_live_abc',
    stripe_payment_intent_id: 'pi_abc',
    offer_code: null,
    discount_percent: null,
    standard_total: null,
    discount_amount: null,
    final_total_after_discount: null,
    first_source: 'google',
    last_source: 'google',
    landing_page: '/',
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    gclid: null,
    email_customer_sent: true,
    email_business_sent: true,
    telegram_sent: true,
    sheets_sent: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  it('calculates the balance when total_price and deposit_amount are both present', () => {
    const detail = toDetail(baseRow);
    expect(detail.balance).toBe(219);
  });

  it('returns a null balance, not NaN or a misleading number, when total_price is missing', () => {
    const detail = toDetail({ ...baseRow, total_price: null });
    expect(detail.balance).toBeNull();
    expect(Number.isNaN(detail.balance)).toBe(false);
  });

  it('returns a null balance when deposit_amount is missing', () => {
    const detail = toDetail({ ...baseRow, deposit_amount: null });
    expect(detail.balance).toBeNull();
  });

  it('never includes confirmation_token even if present on the source row', () => {
    const detail = toDetail({ ...baseRow, confirmation_token: 'super-secret-token' });
    expect(detail).not.toHaveProperty('confirmationToken');
    expect(JSON.stringify(detail)).not.toContain('super-secret-token');
  });

  it('nests Stripe identifiers as read-only reference values', () => {
    const detail = toDetail(baseRow);
    expect(detail.stripe).toEqual({ sessionId: 'cs_live_abc', paymentIntentId: 'pi_abc' });
  });

  it('nests notification delivery flags', () => {
    const detail = toDetail(baseRow);
    expect(detail.notifications).toEqual({
      emailCustomerSent: true,
      emailBusinessSent: true,
      telegramSent: true,
      sheetsSent: true,
    });
  });
});
