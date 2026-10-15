import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EotQuoteWizard from './EotQuoteWizard';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';

vi.mock('../lib/privatePage', () => ({ canUseGoogleTags: () => true, isPrivatePage: () => false }));
const gtag = vi.fn();
beforeEach(() => {
  vi.stubGlobal('gtag', gtag); gtag.mockClear();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const events = (name: string) => gtag.mock.calls.filter((c) => c[1] === name);
const next = () => fireEvent.click(screen.getByRole('button', { name: /^Continue$/ }));
describe('actual quote funnel interactions', () => {
  it('EOT counts only validated forward steps, not backtracking or rendering', async () => {
    const onBook = vi.fn(); render(<EotQuoteWizard onBook={onBook} />);
    next();
    expect(events('step_completed')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '2 beds' }));
    next();
    fireEvent.click(screen.getByRole('button', { name: /^Back$/ }));
    next(); next(); next();
    await waitFor(() => expect(events('quote_calculated')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Request a time/ }));
    expect(onBook).toHaveBeenCalledOnce();
    expect(events('quote_started')).toHaveLength(1);
    expect(events('step_completed').map((c) => c[2].quote_step)).toEqual([1, 2, 3, 4]);
    expect(events('purchase')).toHaveLength(0);
    expect(events('deposit_paid')).toHaveLength(0);
  });
  it('carpet editing reports settled price and one completion only on valid handoff', async () => {
    const onBook = vi.fn();
    render(<MemoryRouter><BookingProvider><QuoteCalculator mode="carpet" onBook={onBook} /></BookingProvider></MemoryRouter>);
    expect(events('quote_started')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await waitFor(() => expect(events('quote_calculated')).toHaveLength(1));
    expect(events('quote_calculated')[0][2].quoted_total).toBe(85);
    const submit = screen.getAllByRole('button', { name: /Request a time/ })[0];
    fireEvent.click(submit); fireEvent.click(submit);
    expect(events('quote_started')).toHaveLength(1);
    expect(events('step_completed')).toHaveLength(1);
    expect(events('step_completed')[0][2]).toEqual({ event_category: 'funnel', service_type: 'carpet_upholstery', quote_step: 1 });
  });
});
