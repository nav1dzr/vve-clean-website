import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BookingProvider } from '../context/BookingContext';
import QuoteCalculator from './QuoteCalculator';
import ServiceHeroPhoto from './ServiceHeroPhoto';
import GoogleBadge from './GoogleBadge';
import { clearQuoteBasket, readQuoteBasket } from '../lib/quoteBasket';
import { VERIFIED_GOOGLE_RATING } from '../data/googleRating';

beforeEach(() => { clearQuoteBasket(); localStorage.clear(); sessionStorage.clear(); });

describe('explicit service choices and ordinary basket restoration', () => {
  it('opens Move-in after a saved carpet quote without carrying carpet quantities over', async () => {
    const user = userEvent.setup();
    const first = render(<MemoryRouter><BookingProvider><QuoteCalculator mode="carpet" /></BookingProvider></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    expect(readQuoteBasket()?.config.deepService).toBe('carpet_upholstery');
    first.unmount();
    render(<MemoryRouter><BookingProvider><QuoteCalculator homepageMode homepageService="move_in" /></BookingProvider></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Increase Bedroom quantity' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^1 Bed$/ }));
    expect(readQuoteBasket()?.config.deepService).toBe('move_in');
    expect(Object.values(readQuoteBasket()?.config.carpetCounts as Record<string, number> ?? {}).every(count => count === 0)).toBe(true);
  });

  it('keeps saved carpet quantities when returning without an explicit new service', async () => {
    const user = userEvent.setup();
    const tree = <MemoryRouter><BookingProvider><QuoteCalculator mode="carpet" /></BookingProvider></MemoryRouter>;
    const first = render(tree);
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    first.unmount();
    render(tree);
    expect(screen.getByRole('button', { name: 'Decrease Bedroom quantity' })).toBeEnabled();
    expect(screen.getAllByText('£85').length).toBeGreaterThan(0);
  });
});

describe('truthful proof when remote media or rating refresh is unavailable', () => {
  it('uses the local photograph if managed media fails, then provides a useful gallery link if both fail', () => {
    render(<ServiceHeroPhoto src="/managed.jpg" alt="Managed job" caption="Managed caption" fallback={{ src: '/local.jpg', alt: 'Local job', caption: 'Local caption' }} />);
    fireEvent.error(screen.getByRole('img', { name: 'Managed job' }));
    expect(screen.getByRole('img', { name: 'Local job' })).toHaveAttribute('src', '/local.jpg');
    expect(screen.getByText('Local caption')).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img', { name: 'Local job' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cleaning results in the gallery/i })).toHaveAttribute('href', '/gallery');
  });

  it('shows when a saved Google rating was checked, without relying on hover', () => {
    render(<GoogleBadge />);
    if (VERIFIED_GOOGLE_RATING) {
      expect(screen.getByText(/^Checked /)).toBeVisible();
      expect(screen.getByRole('link')).toHaveAccessibleName(expect.stringContaining('Checked'));
    } else {
      expect(screen.getByText('Google Reviews')).toBeVisible();
    }
  });
});
