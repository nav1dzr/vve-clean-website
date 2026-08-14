// Regression guard for the fully rendered homepage's team-first positioning.
//
// Individual sections (Hero, OurKit, TeamTrust) have their own copy, but
// nothing previously asserted on the homepage as a whole — which is how a
// contradictory "Independent & Owner-Operated — No Call Centres, No Random
// Cleaners" hero badge and a "run by ... the founder, on every job" OurKit
// line shipped alongside a deliberately team-first TeamTrust section. This
// renders the real HomePage composition and checks the merged text once.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  sessionStorage.clear();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CookieConsentProvider><HomePage /></CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('HomePage — team-first positioning (fully rendered)', () => {
  it('never frames VVE Clean as owner-operated or founder-attends-every-job anywhere on the page', () => {
    renderHome();
    const text = (document.body.textContent || '').toLowerCase();
    expect(text).not.toMatch(
      /owner-operated|owner-run|founder attends|same cleaner attends every job|one owner|not a single owner|not one person|the founder, on every job/,
    );
  });

  it('never defines the company by a negative comparison to call centres or "random cleaners"', () => {
    renderHome();
    const text = (document.body.textContent || '').toLowerCase();
    expect(text).not.toMatch(/no call centres|no random cleaners/);
  });

  it('keeps the hero badge positive and supported, not a negative comparison', () => {
    renderHome();
    const text = document.body.textContent || '';
    expect(text).toMatch(/Independent & Team-Run/);
  });

  it('still surfaces the team-first TeamTrust section with the real origin story', () => {
    renderHome();
    const text = document.body.textContent || '';
    expect(text).toMatch(/three friends who had each worked for different cleaning companies/i);
  });
});
