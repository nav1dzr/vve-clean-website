import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingPage from './BookingPage';
import { CONSENT_STORAGE_KEY, REJECT_OPTIONAL_CATEGORIES } from '../lib/consent';
import { CONSENT_VERSION } from '../lib/consentVersion';

// Essential storage (quote/booking restoration) must keep working even when
// the visitor has explicitly rejected optional (analytics/advertising)
// cookies — it is not gated by consent at all. BookingPage itself never
// reads consent state; this proves rejecting consent has no side effect on
// the sessionStorage-backed booking flow.

const VALID_SELECTION = {
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
};

function seedSelection() {
  sessionStorage.setItem('vve_booking', JSON.stringify(VALID_SELECTION));
}

function seedRejectedConsent() {
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({
      ...REJECT_OPTIONAL_CATEGORIES,
      choice: 'rejected_optional',
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    }),
  );
}

function renderBookingPage() {
  return render(
    <MemoryRouter initialEntries={['/booking']}>
      <BookingPage />
    </MemoryRouter>,
  );
}

describe('BookingPage — essential storage is unaffected by rejected optional consent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('still restores the quote selection from sessionStorage when optional consent was rejected', () => {
    seedRejectedConsent();
    seedSelection();
    renderBookingPage();

    expect(screen.getByRole('heading', { name: 'Complete your booking request' })).toBeInTheDocument();
    expect(screen.getByText('Window Cleaning')).toBeInTheDocument();
  });

  it('still restores the quote selection when no consent choice has been made at all', () => {
    seedSelection();
    renderBookingPage();

    expect(screen.getByRole('heading', { name: 'Complete your booking request' })).toBeInTheDocument();
    expect(screen.getByText('Window Cleaning')).toBeInTheDocument();
  });
});
