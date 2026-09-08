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

describe('Terms — request-first flow with deposit after agreement', () => {
  it('allows an unavailable time to be declined without a charge', () => {
    const { container } = renderTerms();
    expect(container.textContent ?? '').toMatch(/closest alternatives we can offer/i);
    expect(container.textContent ?? '').toMatch(/decline them and nothing is charged/i);
  });

  it('distinguishes the free request from an agreed £30 deposit', () => {
    const { container } = renderTerms();
    const text = container.textContent ?? '';
    expect(text).toMatch(/No payment is taken when you send that request/i);
    expect(text).toMatch(/we send an offer with a £30 deposit link/i);
    expect(text).toMatch(/booking is confirmed when the deposit payment is verified/i);
    expect(text).toMatch(/remaining balance is normally due after the service/i);
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

  it('keeps the request free while explaining the later agreed deposit', () => {
    const { container } = renderBooking();
    const text = container.textContent ?? '';
    expect(screen.queryByRole('checkbox', { name: /terms of service/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send request — no payment' })).toBeInTheDocument();
    expect(text).not.toMatch(/Stripe checkout|pay now/i);
    expect(text).toMatch(/After you agree the details, we send a £30 deposit request/i);
    expect(text).toMatch(/Booking and cancellation terms apply once an appointment is confirmed/i);
  });

  it('shows the manager review and customer-agreement steps', () => {
    const { container } = renderBooking();
    const text = container.textContent ?? '';
    expect(text).toMatch(/request goes to the VVE manager queue/i);
    expect(text).toMatch(/We check the date, access details and final price, then contact you/i);
    expect(text).toMatch(/Payment confirms the appointment and comes off your total/i);
  });
});
