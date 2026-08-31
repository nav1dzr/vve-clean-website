import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CarpetCleaningPage from './CarpetCleaningPage';
import SofaCleaningPage from './SofaCleaningPage';
import QuoteCalculator from '../components/QuoteCalculator';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { BookingProvider } from '../context/BookingContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
});

function renderPage(node: React.ReactNode, path: string) {
  return render(<MemoryRouter initialEntries={[path]}><CookieConsentProvider>{node}</CookieConsentProvider></MemoryRouter>);
}

function renderCalc(mode: 'all-services' | 'carpet' | 'upholstery') {
  return render(<MemoryRouter><BookingProvider><QuoteCalculator mode={mode} /></BookingProvider></MemoryRouter>);
}

describe('service trust copy', () => {
  it('does not publish a universal DBS claim on carpet or sofa pages', () => {
    const carpet = renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    expect(carpet.container.textContent ?? '').not.toMatch(/DBS/);
    carpet.unmount();
    const sofa = renderPage(<SofaCleaningPage />, '/sofa-cleaning-london');
    expect(sofa.container.textContent ?? '').not.toMatch(/DBS/);
  });

  it.each(['all-services', 'carpet', 'upholstery'] as const)('%s calculator uses service-neutral trust items', (mode) => {
    renderCalc(mode);
    for (const item of [
      '£5m public liability insurance',
      'Clear scope before work starts',
      'Published prices for standard services',
      'No payment to send a request',
      'Direct contact with VVE Clean',
    ]) expect(screen.getByText(item)).toBeInTheDocument();
    expect(screen.queryByText(/72hr re-clean guarantee/i)).not.toBeInTheDocument();
  });
});
