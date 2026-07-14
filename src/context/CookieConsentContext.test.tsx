import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from './CookieConsentContext';
import Footer from '../components/Footer';
import { CONSENT_STORAGE_KEY, type ConsentCategories, type ConsentChoice } from '../lib/consent';
import { CONSENT_VERSION } from '../lib/consentVersion';

function renderApp() {
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <div>Page content</div>
        <Footer />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

function seedConsent(categories: ConsentCategories, choice: ConsentChoice = 'custom') {
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ ...categories, choice, version: CONSENT_VERSION, timestamp: new Date().toISOString() }),
  );
}

let gtagSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  gtagSpy = vi.fn();
  // @ts-expect-error test-only global assignment
  window.gtag = gtagSpy;
});

describe('CookieConsentProvider — first visit', () => {
  it('shows the banner with Accept all, Reject optional and Manage choices', () => {
    renderApp();
    expect(screen.getByRole('region', { name: /cookie consent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^accept all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject optional$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage choices/i })).toBeInTheDocument();
  });

  it('does not write any consent to storage before the visitor chooses', () => {
    renderApp();
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });
});

describe('CookieConsentProvider — Accept all', () => {
  it('persists both categories granted, updates gtag, and hides the banner', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /^accept all$/i }));

    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored).toMatchObject({ analytics: true, advertising: true, choice: 'accepted_all', version: CONSENT_VERSION });
    expect(gtagSpy).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({
        ad_storage: 'granted',
        analytics_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      }),
    );
  });
});

describe('CookieConsentProvider — Reject optional', () => {
  it('persists both categories denied, updates gtag, and hides the banner', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /^reject optional$/i }));

    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored).toMatchObject({ analytics: false, advertising: false, choice: 'rejected_optional' });
    expect(gtagSpy).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      }),
    );
  });
});

describe('CookieConsentProvider — Manage choices', () => {
  it('opens an accessible dialog with Essential always-on, and Analytics/Advertising defaulting to off on first visit', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /manage choices/i }));

    const dialog = screen.getByRole('dialog', { name: /cookie settings/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Essential' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Advertising' })).toBeInTheDocument();

    const essentialToggle = document.getElementById('consent-essential');
    const analyticsToggle = document.getElementById('consent-analytics');
    const advertisingToggle = document.getElementById('consent-advertising');
    expect(essentialToggle).toHaveAttribute('aria-checked', 'true');
    expect(essentialToggle).toBeDisabled();
    expect(analyticsToggle).toHaveAttribute('aria-checked', 'false');
    expect(advertisingToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('lets the visitor grant only analytics and saves a custom choice', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /manage choices/i }));
    await user.click(document.getElementById('consent-analytics')!);
    await user.click(screen.getByRole('button', { name: /save choices/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored).toMatchObject({ analytics: true, advertising: false, choice: 'custom' });
    expect(gtagSpy).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' }),
    );
  });

  it('closes on Escape without saving, and the banner remains since no choice was recorded', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /manage choices/i }));
    await user.click(document.getElementById('consent-analytics')!); // unsaved change

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('region', { name: /cookie consent/i })).toBeInTheDocument();
  });

  it('closes on a backdrop click without saving', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /manage choices/i }));
    await user.click(document.getElementById('consent-advertising')!); // unsaved change

    fireEvent.click(screen.getByTestId('cookie-modal-backdrop'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('moves focus to the dialog close button when it opens', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /manage choices/i }));
    expect(screen.getByRole('button', { name: /close cookie settings/i })).toHaveFocus();
  });
});

describe('CookieConsentProvider — reopening settings from the footer', () => {
  it('shows a "Cookie settings" link in the footer that reopens the dialog', async () => {
    seedConsent({ analytics: false, advertising: false }, 'rejected_optional');
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cookie settings/i }));
    expect(screen.getByRole('dialog', { name: /cookie settings/i })).toBeInTheDocument();
  });

  it('pre-fills the dialog with the visitor\'s previously saved choices', async () => {
    seedConsent({ analytics: true, advertising: false }, 'custom');
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /cookie settings/i }));

    expect(document.getElementById('consent-analytics')).toHaveAttribute('aria-checked', 'true');
    expect(document.getElementById('consent-advertising')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('CookieConsentProvider — persists across a refresh', () => {
  it('does not show the banner again, and re-applies the saved consent to gtag on load', () => {
    seedConsent({ analytics: true, advertising: true }, 'accepted_all');
    renderApp();

    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
    expect(gtagSpy).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'granted' }),
    );
  });

  it('re-prompts if the stored consent was recorded under an older policy version', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ analytics: true, advertising: true, choice: 'accepted_all', version: '2000-01-01', timestamp: 'x' }),
    );
    renderApp();
    expect(screen.getByRole('region', { name: /cookie consent/i })).toBeInTheDocument();
  });
});

describe('CookieConsentProvider — Accept and Reject are equally easy to find', () => {
  it('renders both banner buttons with the same base size/weight classes, differing only in colour', () => {
    renderApp();
    const acceptClasses = screen.getByRole('button', { name: /^accept all$/i }).className;
    const rejectClasses = screen.getByRole('button', { name: /^reject optional$/i }).className;
    // Same shared base string (size/shape/weight) — confirms neither button
    // was styled as visually dominant over the other.
    expect(acceptClasses).toContain('min-h-[44px]');
    expect(rejectClasses).toContain('min-h-[44px]');
    expect(acceptClasses).toContain('px-5 rounded-lg text-sm font-semibold');
    expect(rejectClasses).toContain('px-5 rounded-lg text-sm font-semibold');
  });

  it('gives every actionable control at least a 44px minimum tap target', () => {
    renderApp();
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/min-h-\[44px\]/);
    }
  });
});
