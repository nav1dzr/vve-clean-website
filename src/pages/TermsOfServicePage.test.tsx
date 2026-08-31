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

describe('TermsOfServicePage — booking request / deposit clarity', () => {
  it('explains the request is free and a later £30 deposit is deducted from the final total', () => {
    const text = renderPage();
    expect(text).toMatch(/No payment is taken when you send that request/i);
    expect(text).toMatch(/If you accept the offered time, we send a secure link for a\s*£30 deposit/i);
    expect(text).toMatch(/deducted from your final total/i);
  });

  it('explains the preferred time is a request until accepted and deposited', () => {
    const text = renderPage();
    expect(text).toMatch(/is a\s*booking request, not a confirmed appointment/i);
    expect(text).toMatch(/confirmed only after we have agreed the time with you and received any required deposit/i);
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

  it('renders at the Terms of Service route linked before a deposit is paid', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeInTheDocument();
  });
});
