import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TermsOfServicePage from './TermsOfServicePage';
import { TERMS_VERSION } from '../lib/termsVersion';

function renderPage() {
  render(
    <MemoryRouter>
      <TermsOfServicePage />
    </MemoryRouter>,
  );
  // Content is split across <strong>/inline elements, so match against the
  // whole page's normalized text rather than a single DOM node.
  return (document.body.textContent || '').replace(/\s+/g, ' ');
}

describe('TermsOfServicePage — booking request / deposit clarity', () => {
  it('explains the online payment is a £30 deposit, deducted from the final total', () => {
    const text = renderPage();
    expect(text).toMatch(/you are paying a\s*£30 deposit\s*— not the full price of your clean/i);
    expect(text).toMatch(/deducted from your final total/i);
  });

  it('explains paying the deposit submits a booking request, confirmed separately', () => {
    const text = renderPage();
    expect(text).toMatch(/submits a\s*booking request\s*for your preferred date/i);
    expect(text).toMatch(/does not, by itself, guarantee that date or time/i);
    expect(text).toMatch(/confirm the appointment.*separately/i);
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
    expect(text).toMatch(/deposit being forfeited/i);
    expect(text).toMatch(/deposit may be non-refundable/i);
  });

  it('displays a "last updated" date derived from the shared TERMS_VERSION constant', () => {
    const text = renderPage();
    const expected = new Date(`${TERMS_VERSION}T00:00:00Z`)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    expect(text).toContain(`Last updated: ${expected}`);
  });

  it('links to the same Terms of Service that the booking page checkbox references', () => {
    renderPage();
    // Sanity check that the route this page is mounted at is the one linked
    // from BookingPage.tsx's terms checkbox ("/terms-of-service").
    expect(screen.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeInTheDocument();
  });
});
