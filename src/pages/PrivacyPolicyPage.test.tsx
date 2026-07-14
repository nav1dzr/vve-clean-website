import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { CONSENT_VERSION } from '../lib/consentVersion';

function renderPage() {
  render(
    <MemoryRouter>
      <CookieConsentProvider>
        <PrivacyPolicyPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
  return (document.body.textContent || '').replace(/\s+/g, ' ');
}

describe('PrivacyPolicyPage — cookies and Google Consent Mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('explains essential storage and lists what it covers', () => {
    const text = renderPage();
    expect(text).toMatch(/Essential storage \(always on\)/);
    expect(text).toMatch(/remembering your quote and booking selections/i);
    expect(text).toMatch(/leaflet or advert brought you to the site/i);
  });

  it('explains analytics storage is optional and off by default', () => {
    const text = renderPage();
    expect(text).toMatch(/Analytics storage \(optional\)/);
    expect(text).toMatch(/switched off until you agree to it/i);
  });

  it('explains advertising storage is optional and off by default', () => {
    const text = renderPage();
    expect(text).toMatch(/Advertising storage \(optional\)/);
  });

  it('explains Google Consent Mode in plain English, including that the tag is not duplicated to bypass a rejection', () => {
    const text = renderPage();
    expect(text).toMatch(/Google Consent Mode/);
    expect(text).toMatch(/no cookies, no storage/i);
    expect(text).toMatch(/do not separately load or duplicate Google's tracking tag/i);
  });

  it('explains how to change the choice, and links to the reopenable cookie settings', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('heading', { name: 'How to change your choice' })).toBeInTheDocument();

    // Two controls on this page can reopen settings: the footer's "Cookie
    // settings" button and the inline link inside the cookies section text —
    // exact-match the footer one (capital C) to avoid ambiguity.
    await user.click(screen.getByRole('button', { name: 'Cookie settings' }));
    expect(screen.getByRole('dialog', { name: /cookie settings/i })).toBeInTheDocument();
  });

  it('derives "Last updated" from the shared CONSENT_VERSION constant', () => {
    const text = renderPage();
    const expected = new Date(`${CONSENT_VERSION}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    expect(text).toContain(`Last updated: ${expected}`);
  });
});
