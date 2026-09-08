import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuoteCalculator from './QuoteCalculator';
import EotQuoteWizard from './EotQuoteWizard';
import { clearQuoteBasket, readQuoteBasket } from '../lib/quoteBasket';
import { BookingProvider } from '../context/BookingContext';

describe('a visitor can continue a cleaning basket after leaving the page', () => {
  it('restores carpet and sofa items together and recalculates their current price', async () => {
    const user = userEvent.setup();
    const tree = <MemoryRouter><BookingProvider><QuoteCalculator mode="carpet" /></BookingProvider></MemoryRouter>;
    const first = render(tree);
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: /Increase 3.seater sofa quantity/i }));
    expect(readQuoteBasket()?.config.carpetCounts).toMatchObject({ bedroom: 1, sofa_3: 1 });
    expect(readQuoteBasket()).not.toHaveProperty('price');
    first.unmount(); render(tree);
    expect(screen.getAllByText('£145').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Decrease 3.seater sofa quantity/i })).toBeEnabled();
  });
  it('empties the saved basket when the final item is removed', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookingProvider><QuoteCalculator mode="carpet" /></BookingProvider></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    expect(readQuoteBasket()).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Decrease Bedroom quantity' }));
    expect(readQuoteBasket()).toBeNull();
  });
  it('restores an EOT property, package and in-progress wizard step through the main calculator', async () => {
    const user = userEvent.setup(); const first = render(<EotQuoteWizard onBook={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'House / Maisonette' }));
    await user.click(screen.getByRole('button', { name: /^Continue$/ }));
    expect(readQuoteBasket()?.step).toBe(2); first.unmount();
    render(<MemoryRouter><BookingProvider><QuoteCalculator mode="eot" /></BookingProvider></MemoryRouter>);
    expect(screen.getByRole('group', { name: 'Cleaning package' })).toBeInTheDocument();
    expect(readQuoteBasket()?.config.propertyType).toBe('house');
  });
  it('ignores expired or malformed data, and clears saved booking hand-offs with the basket', () => {
    localStorage.setItem('vve_quote_basket_v1', '{invalid'); expect(readQuoteBasket()).toBeNull();
    localStorage.setItem('vve_quote_basket_v1', JSON.stringify({ version: 1, kind: 'standard', label: 'Old selection', href: '/#quote', config: {}, savedAt: Date.now() - 15 * 86400000 })); expect(readQuoteBasket()).toBeNull();
    sessionStorage.setItem('vve_booking', 'old'); clearQuoteBasket(); expect(sessionStorage.getItem('vve_booking')).toBeNull(); expect(readQuoteBasket()).toBeNull();
  });
});
