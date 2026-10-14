import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';

vi.mock('./GoogleBadge', () => ({ default: () => null }));

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

beforeEach(() => sessionStorage.clear());

describe('After-builders selection in the general quote calculator', () => {
  it('offers an assessed quote and guided project form without a default property or checkout amount', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <BookingProvider>
          <Routes>
            <Route path="/" element={<QuoteCalculator />} />
            <Route path="/after-builders-cleaning-london" element={<h1>Project details form</h1>} />
          </Routes>
        </BookingProvider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'After builders' }));

    expect(screen.getAllByText('Assessed quote')).toHaveLength(2);
    expect(container).not.toHaveTextContent('From £249');
    expect(container).not.toHaveTextContent('Studio · 1 bath');
    expect(screen.queryByRole('button', { name: /Request a time/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See indicative budget ranges' })).toHaveAttribute('href', '/after-builders-cleaning-london#builders-prices');
    expect(screen.getByRole('link', { name: 'WhatsApp a photo for your quote' })).toHaveAttribute('href', expect.stringContaining('wa.me/447845451111'));

    const guidedQuote = screen.getByRole('link', { name: 'Tell us about your project →' });
    expect(guidedQuote).toHaveAttribute('href', '/after-builders-cleaning-london#builders-quote');
    await user.click(guidedQuote);
    expect(screen.getByRole('heading', { name: 'Project details form' })).toBeInTheDocument();
  });
});
