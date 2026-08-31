import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingPage from './BookingPage';
import TermsOfServicePage from './TermsOfServicePage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

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
        windowSize: 'medium',
        parkingAvailable: '',
        congestionZone: '',
      },
    }),
  );
});

const renderTerms = () => render(
  <MemoryRouter initialEntries={['/terms-of-service']}>
    <CookieConsentProvider><TermsOfServicePage /></CookieConsentProvider>
  </MemoryRouter>,
);

const renderBooking = () => render(
  <MemoryRouter initialEntries={['/booking']}><BookingPage /></MemoryRouter>,
);

describe('Terms — request-first flow with online deposits archived', () => {
  it('allows an unavailable time to be declined without a charge', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').toMatch(/closest alternatives we can offer/i);
    expect(container.textContent ?? '').toMatch(/decline them and nothing is charged/i);
  });

  it('contains no active £30 deposit or Stripe-checkout promise', () => {
    const { container } = renderTerms();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/£30 deposit|deposit link|Stripe secure checkout/i);
    expect(text).toMatch(/full balance is normally due after the service/i);
  });

  it('makes any late-cancellation or call-out charge depend on written agreement', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').toMatch(/charge applies only if it was stated and agreed in writing/i);
  });
});

describe('Booking page — no-payment request', () => {
  it('explains that the chosen time is a request and takes no payment', () => {
    renderBooking();
    const note = screen.getByText(/This is a request, not a confirmed appointment/i);
    expect(note).toHaveTextContent(/no payment is taken at this stage/i);
  });

  it('does not ask for payment or show deposit/Stripe language', () => {
    const { container } = renderBooking();
    const text = container.textContent ?? '';
    expect(screen.queryByRole('checkbox', { name: /terms of service/i })).not.toBeInTheDocument();
    expect(text).not.toMatch(/£30 deposit|deposit link|Stripe checkout/i);
    expect(text).toMatch(/Booking and cancellation terms apply once an appointment is confirmed/i);
  });

  it('shows the manager review and customer-agreement steps', () => {
    const { container } = renderBooking();
    const text = container.textContent ?? '';
    expect(text).toMatch(/request goes to the VVE manager queue/i);
    expect(text).toMatch(/confirm the appointment after you agree the time, scope and final price/i);
  });
});
