import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingPage from './BookingPage';
import TermsOfServicePage from './TermsOfServicePage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

// What happens when VVE Clean cannot offer the requested slot. The terms
// previously covered only customer-initiated cancellations, so the case where
// the business cannot fulfil the request was unaddressed.
//
// The refund is NOT automatic: api/stripe-webhook.js handles only
// checkout.session.completed and discards charge.refunded (see
// docs/BACKEND_AUDIT_2026-08-03.md finding 1). A staff member initiates it in
// Stripe. The copy must therefore never claim the refund happens
// automatically — that would promise behaviour the system does not have.

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    'vve_booking',
    JSON.stringify({
      serviceName: 'Window Cleaning',
      price: 120,
      quoteConfig: {
        service: 'window',
        deepService: 'end_of_tenancy',
        deepSize: 'bed1',
        deepBaths: 1,
        addOnCounts: {},
        windowSize: 'medium',
        gutterType: 'two_storey',
        officeHours: 1,
      },
    }),
  );
});

const renderTerms = () =>
  render(
    <MemoryRouter initialEntries={['/terms-of-service']}>
      <CookieConsentProvider>
        <TermsOfServicePage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );

const renderBooking = () =>
  render(
    <MemoryRouter initialEntries={['/booking']}>
      <BookingPage />
    </MemoryRouter>,
  );

describe('Terms — unavailable slot refund', () => {
  it('commits to refunding the deposit in full', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').toMatch(/refund your £30 deposit in full/i);
  });

  // Card settlement time belongs to the issuer. "It will reach your card
  // within N days" is a guarantee VVE Clean cannot enforce, so the copy
  // describes the typical range and says plainly who controls it.
  it('describes card timing as typical and issuer-controlled, not guaranteed', () => {
    const { container } = renderTerms();
    const text = container.textContent ?? '';

    expect(text).toMatch(/typically appear about 5 to 10 business days/i);
    expect(text).toMatch(/controlled by your card issuer/i);
    expect(text).not.toMatch(/will reach your card within/i);
    expect(text).not.toMatch(/\b14 business days\b/);
  });

  // The refund is issued by hand; the webhook discards charge.refunded.
  it('never claims the refund is automatic', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').not.toMatch(/refunded automatically|automatic refund/i);
  });

  // No operational SLA is published until the owner confirms one.
  it('publishes no unconfirmed turnaround commitment', () => {
    const { container } = renderTerms();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/within one business day/i);
    expect(text).not.toMatch(/start that refund within/i);
  });

  it('tells the customer what to do if the money does not arrive', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').toMatch(/has not appeared after 10 business days/i);
  });

  it('offers alternatives before refunding, matching the real process', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').toMatch(/closest alternatives we can offer/i);
  });

  it('keeps the existing customer-cancellation terms intact', () => {
    const { container } = renderTerms();
    const text = container.textContent ?? '';

    expect(text).toMatch(/deposit may be non-refundable/i);
    expect(text).toMatch(/free reschedule/i);
  });
});

describe('Booking page — progressive disclosure of the refund', () => {
  it('reassures at the point of choosing a date without a wall of text', () => {
    renderBooking();

    const note = screen.getByText(/cannot offer a slot that works for you/i);
    expect(note).toBeInTheDocument();
    // One clause, not a policy block beside the payment button.
    expect((note.textContent ?? '').length).toBeLessThan(260);
  });

  it('links to the booking terms rather than restating them', () => {
    renderBooking();

    const link = screen.getByRole('link', { name: /see booking terms/i });
    expect(link).toHaveAttribute('href', '/terms-of-service#bookings');
  });

  // Progressive disclosure: the short version makes no timing claim at all,
  // so it cannot contradict the terms or overpromise settlement.
  it('makes no timing claim beside the payment flow', () => {
    const { container } = renderBooking();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/business days/i);
    expect(text).not.toMatch(/5 to 10/);
  });

  it('does not claim the refund is automatic', () => {
    const { container } = renderBooking();
    expect(container.textContent ?? '').not.toMatch(/refunded automatically|automatic refund/i);
  });

  it('still says the deposit buys a request, not a confirmed slot', () => {
    const { container } = renderBooking();
    const text = container.textContent ?? '';

    expect(text).toMatch(/confirm availability separately/i);
    expect(text).toMatch(/booking request/i);
  });
});
