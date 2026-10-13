import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ServiceDecisionTrust from './ServiceDecisionTrust';
import QuoteCalculator, { type BookingSelection } from './QuoteCalculator';
import BookingPage from '../pages/BookingPage';
import { BookingProvider } from '../context/BookingContext';
import { useGoogleRating } from '../hooks/useGoogleRating';
import { DEPOSIT_P, EOT_GUARANTEE_HOURS, penceToDisplay } from '../data/pricing';

vi.mock('../hooks/useGoogleRating', () => ({ useGoogleRating: vi.fn() }));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(useGoogleRating).mockReturnValue(null);
});

const panel = () => screen.getByRole('complementary', { name: 'Before you send your request' });

describe('ServiceDecisionTrust — factual, contextual proof', () => {
  it('keeps an absent rating non-numeric and explains the configured deposit after agreement', () => {
    render(<ServiceDecisionTrust service="carpet" />);
    expect(within(panel()).getByRole('link', { name: /Read our reviews on Google/ })).toBeInTheDocument();
    expect(panel()).not.toHaveTextContent('5.0');
    expect(panel()).toHaveTextContent(`agree the details before emailing your ${penceToDisplay(DEPOSIT_P)} deposit options`);
    expect(panel()).toHaveTextContent('No payment to send your request.');
    expect(panel()).toHaveTextContent('The deposit comes off your total.');
    expect(panel()).toHaveTextContent('Your booking is confirmed once the deposit is paid.');
    expect(panel().querySelector('blockquote')).toBeNull();
  });

  it('uses the existing checked/updated rating source without inventing a score', () => {
    vi.mocked(useGoogleRating).mockReturnValue({ value: 4.7, count: 31, verifiedOn: '2026-10-01', live: true });
    render(<ServiceDecisionTrust service="sofa" />);
    expect(panel()).toHaveTextContent('4.7');
    expect(panel()).toHaveTextContent('31 reviews');
    expect(panel()).toHaveTextContent('Updated 1 Oct 2026');
    expect(panel()).not.toHaveTextContent('5.0');
  });

  it.each([
    [{ bedroom: 1 }, 'carpet fibres and condition'],
    [{ sofa_2: 1 }, 'fabric and test a small area'],
    [{ bedroom: 1, sofa_2: 1 }, 'carpet fibres and upholstery fabrics'],
    [{ bedroom: 0, sofa_2: 1 }, 'fabric and test a small area'],
  ])('matches the actual combined-quote selection %j', (counts, copy) => {
    render(<ServiceDecisionTrust service="carpet-upholstery" carpetCounts={counts} />);
    expect(panel()).toHaveTextContent(copy);
    expect(panel()).not.toHaveTextContent('reporting window');
    expect(within(panel()).queryByRole('link', { name: /Re-clean terms/ })).not.toBeInTheDocument();
  });

  it.each([
    ['complete', 'the agreed checklist'],
    ['tailored', 'selected tasks'],
  ] as const)('keeps %s guarantee scope and the actual reporting window', (eotPackage, scope) => {
    render(<ServiceDecisionTrust service="eot" eotPackage={eotPackage} />);
    expect(panel()).toHaveTextContent(`${EOT_GUARANTEE_HOURS / 24}-day reporting window on ${scope}`);
    expect(panel()).toHaveTextContent('One free return for covered missed work.');
    const terms = within(panel()).getByRole('link', { name: /Re-clean terms/ });
    expect(terms).toHaveAttribute('href', '/end-of-tenancy-cleaning-london#guarantee');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAccessibleName(/opens in a new tab/);
  });

  it('does not attach a specialist guarantee or fabricated quote to other services', () => {
    render(<ServiceDecisionTrust service="other" />);
    expect(panel()).not.toHaveTextContent(/fibre|fabric|re-clean|insurance/i);
    expect(panel().querySelector('blockquote')).toBeNull();
  });
});

describe('Trust beside the actual quote/request decision', () => {
  it.each([
    ['carpet', 'Bedroom', 'carpet fibres and condition'],
    ['upholstery', '2-seater sofa', 'fabric and test a small area'],
  ] as const)('shows %s proof once items are selected, immediately before its action', async (mode, item, copy) => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<MemoryRouter><BookingProvider><QuoteCalculator mode={mode} onBook={onBook} /></BookingProvider></MemoryRouter>);
    expect(screen.queryByRole('complementary', { name: 'Before you send your request' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Increase ${item} quantity` }));
    expect(panel()).toHaveTextContent(copy);
    const request = screen.getAllByRole('button', { name: 'Request a time — no payment' }).find(button => button.previousElementSibling === panel());
    expect(request).toBeDefined();
    await user.click(request!);
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onBook.mock.calls[0][0].quoteConfig.deepService).toBe('carpet_upholstery');
  });

  it.each([
    ['end_of_tenancy', undefined, 'tailored', 'reporting window on selected tasks'],
    ['carpet_upholstery', { sofa_2: 1 }, undefined, 'fabric and test a small area'],
    ['carpet_upholstery', { bedroom: 1, sofa_2: 1 }, undefined, 'carpet fibres and upholstery fabrics'],
  ] as const)('keeps the %s proof relevant on the details form', (deepService, counts, eotPackage, copy) => {
    const selection: BookingSelection = {
      serviceName: 'Synthetic test selection', price: 100,
      quoteConfig: { service: 'deep', deepService, deepSize: 'bed1', deepBaths: 1,
        addOnCounts: {}, windowSize: 'small', gutterType: 'terraced', officeHours: 2,
        carpetCounts: counts, eotPackage },
    };
    sessionStorage.setItem('vve_booking', JSON.stringify(selection));
    render(<MemoryRouter initialEntries={['/booking']}><BookingPage /></MemoryRouter>);
    expect(screen.getAllByRole('complementary', { name: 'Before you send your request' })).toHaveLength(1);
    expect(panel()).toHaveTextContent(copy);
    expect(screen.getByRole('button', { name: 'Send request — no payment' }).previousElementSibling).toBe(panel());
    expect(screen.queryByRole('heading', { name: 'What happens next' })).not.toBeInTheDocument();
  });
});
