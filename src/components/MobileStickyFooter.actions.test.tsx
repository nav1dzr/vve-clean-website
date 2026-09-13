import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileStickyFooter from './MobileStickyFooter';

const context = vi.hoisted(() => ({ state: 'idle', waLink: 'https://wa.me/447845451111?text=Selected%20service', onBook: vi.fn() }));
vi.mock('../context/BookingContext', () => ({ useBookingCtx: () => context }));

afterEach(() => { context.state = 'idle'; vi.clearAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('shared mobile actions preserve the booking journey', () => {
  it('uses the current booking callback only when the quote is ready', () => {
    context.state = 'bookable';
    render(<MobileStickyFooter />);
    fireEvent.click(screen.getByRole('button', { name: 'Request a time · no payment' }));
    expect(context.onBook).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me/447845451111'));
  });

  it('preserves the selected service in a manual quote', () => {
    context.state = 'manual';
    render(<MobileStickyFooter />);
    expect(screen.getByRole('link', { name: 'Request a quote via WhatsApp' })).toHaveAttribute('href', context.waLink);
    expect(screen.getByRole('link', { name: 'WhatsApp — ask us about your clean' })).toHaveAttribute('href', context.waLink);
  });

  it('takes an unfinished quote to the calculator and respects reduced motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const scroll = vi.fn();
    const validate = vi.fn();
    const { container } = render(<><div id="quote" /><MobileStickyFooter /></>);
    container.querySelector('#quote')!.scrollIntoView = scroll;
    document.addEventListener('vve:validate-book', validate);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Get my price' }));
      expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
      vi.advanceTimersByTime(500);
      expect(validate).toHaveBeenCalledOnce();
      expect(context.onBook).not.toHaveBeenCalled();
    } finally { document.removeEventListener('vve:validate-book', validate); }
  });

  it('leaves pages with their own booking controls clear', () => {
    context.state = 'hidden';
    const { container } = render(<MobileStickyFooter />);
    expect(container).toBeEmptyDOMElement();
  });
});
