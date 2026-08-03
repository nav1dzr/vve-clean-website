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
    // The discount code stays essential: the visitor scanned a leaflet asking
    // us to apply it, so storing it is delivering what they requested.
    expect(text).toMatch(/remembering a discount code you have asked us to apply/i);
  });

  it('does not classify campaign measurement as essential storage', () => {
    // It previously said essential storage covered "remembering which leaflet
    // or advert brought you to the site". Recording which advert brought
    // someone is measurement done for us, not a service asked for by them —
    // calling it always-on essential storage misdescribed what the site does.
    const text = renderPage();
    const essential = text.split(/Essential storage \(always on\)/)[1]
      ?.split(/Analytics storage \(optional\)/)[0] ?? '';

    expect(essential).toBeTruthy();
    expect(essential).not.toMatch(/advert brought you|advertising campaign|which advert/i);
    expect(essential).not.toMatch(/utm|gclid/i);
    expect(essential).toMatch(/None of this is used for advertising or measurement/i);
  });

  it('describes campaign attribution under advertising, and says what refusing costs', () => {
    const text = renderPage();
    const advertising = text.split(/Advertising storage \(optional\)/)[1]
      ?.split(/Google Consent Mode/)[0] ?? '';

    expect(advertising).toMatch(/how you reached our site/i);
    expect(advertising).toMatch(/switched off until you agree to it/i);
    // Withdrawal has to be described honestly: we delete, and nothing they
    // care about stops working.
    expect(advertising).toMatch(/delete anything already stored/i);
    expect(advertising).toMatch(/discount you were promised carry on working/i);
    // And it must be clear nothing is transmitted while merely browsing.
    expect(advertising).toMatch(/only at the point you submit it/i);
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
