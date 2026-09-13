import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TermsOfServicePage from './TermsOfServicePage';
import { TERMS_VERSION } from '../lib/termsVersion';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function renderPage() {
  render(
    <MemoryRouter>
      <CookieConsentProvider>
        <TermsOfServicePage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
  // Content is split across <strong>/inline elements, so match against the
  // whole page's normalized text rather than a single DOM node.
  return (document.body.textContent || '').replace(/\s+/g, ' ');
}

describe('TermsOfServicePage — free request and agreed deposit clarity', () => {
  it('explains the request is free and creates no payment obligation', () => {
    const text = renderPage();
    expect(text).toMatch(/No payment is taken when you send that request/i);
    expect(text).toMatch(/does not create a payment obligation/i);
    expect(text).toMatch(/After we agree the time, scope and final price with you, we send an offer with a £30 deposit link/i);
  });

  it('explains the preferred time is a request until time, scope and price are agreed', () => {
    const text = renderPage();
    expect(text).toMatch(/is a\s*booking request, not a confirmed appointment/i);
    expect(text).toMatch(/booking is confirmed when the deposit payment is verified/i);
  });

  it('states when the remaining balance is due', () => {
    const text = renderPage();
    expect(text).toMatch(/remaining balance is due after the service has been completed/i);
  });

  it('states no extra work or price change begins without customer agreement', () => {
    const text = renderPage();
    expect(text).toMatch(/No extra work will begin, and no price change will apply, without your agreement\./);
  });

  it('still covers cancellation/rescheduling rules and failed-access consequences', () => {
    const text = renderPage();
    expect(text).toMatch(/Cancellations and Rescheduling/);
    expect(text).toMatch(/Access and No-Show/);
    expect(text).toMatch(/call-out charge applies only if it was stated and agreed in writing/i);
    expect(text).not.toMatch(/deposit being forfeited|deposit may be non-refundable/i);
  });

  it('states the confirmed VAT and commercial payment position', () => {
    const text = renderPage();
    expect(text).toContain('No VAT is added. VVE Clean is not VAT registered.');
    expect(text).toMatch(/Commercial payment is due after the clean/i);
    expect(text).not.toMatch(/within 14 days of invoice|VAT included|including VAT/i);
  });

  it('uses 24-hour notice while preserving separate refund review and statutory rights', () => {
    const text = renderPage();
    expect(text).toMatch(/at least 24 hours before the agreed arrival time/i);
    expect(text).toMatch(/Rescheduling is free with at least 24 hours/i);
    expect(text).toMatch(/Any refund is reviewed separately/i);
    expect(text).toMatch(/does not limit your statutory cancellation rights/i);
    expect(text).not.toMatch(/noon the day before|12:00 noon/i);
  });

  it('displays a "last updated" date derived from the shared TERMS_VERSION constant', () => {
    const text = renderPage();
    const expected = new Date(`${TERMS_VERSION}T00:00:00Z`)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    expect(text).toContain(`Last updated: ${expected}`);
  });

  it('renders at the Terms of Service route linked from the request form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeInTheDocument();
  });
});
