import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render as renderUI, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { StickyState } from '../context/BookingContext';
import Navbar from './Navbar';
import MobileStickyFooter from './MobileStickyFooter';
import PagePrimaryActionLink from './PagePrimaryActionLink';
import ContactLinkTracking from './ContactLinkTracking';

const context = vi.hoisted(() => ({
  state: 'none' as StickyState,
  price: 0,
  waLink: 'https://wa.me/447845451111?text=Manual%20assessment',
  onBook: vi.fn(),
  setCtx: vi.fn(),
}));
const analytics = vi.hoisted(() => ({
  trackPhoneClick: vi.fn(),
  trackWhatsAppClick: vi.fn(),
  trackEmailClick: vi.fn(),
}));
vi.mock('../context/BookingContext', () => ({ useBookingCtx: () => context }));
vi.mock('../lib/analytics', () => analytics);
vi.mock('./BasketButton', () => ({ default: () => null }));

function render(ui: ReactElement, pathname = '/') {
  return renderUI(<MemoryRouter initialEntries={[pathname]}>{ui}</MemoryRouter>);
}

function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="current-route">{location.pathname}{location.search}{location.hash}</output>;
}

const photoAction = {
  href: 'https://wa.me/447845451111?text=After%20builders%20photos',
  label: 'Send photos for a quote',
  isWa: true,
};

beforeEach(() => {
  context.state = 'none';
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('contextual primary actions', () => {
  it('keeps the homepage navbar default', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', '#quote');
  });

  it('uses the page action in both navbar positions and closes the mobile menu', () => {
    render(<Navbar primaryAction={photoAction} />);
    expect(screen.getByRole('link', { name: photoAction.label })).toHaveAttribute('href', photoAction.href);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = document.getElementById('mobile-nav-menu')!;
    const link = within(menu).getByRole('link', { name: photoAction.label });
    expect(link).toHaveAttribute('target', '_blank');
    fireEvent.click(link);
    expect(document.getElementById('mobile-nav-menu')).toBeNull();
  });

  it('keeps an area selector on the current page without calculator validation', () => {
    const validate = vi.fn();
    document.addEventListener('vve:validate-book', validate);
    render(<MobileStickyFooter fallbackAction={{ href: '#area-services', label: 'Choose my service' }} />);
    const link = screen.getByRole('link', { name: 'Choose my service' });
    expect(link).toHaveAttribute('href', '#area-services');
    expect(link).not.toHaveAttribute('target');
    fireEvent.click(link);
    expect(validate).not.toHaveBeenCalled();
    document.removeEventListener('vve:validate-book', validate);
  });

  it('uses the exact photo-quote action without redirecting to the homepage', () => {
    render(<MobileStickyFooter fallbackAction={photoAction} />);
    const link = screen.getByRole('link', { name: photoAction.label });
    expect(link).toHaveAttribute('href', photoAction.href);
    expect(screen.queryByRole('button', { name: 'Get my price' })).not.toBeInTheDocument();
  });

  it('preserves bookable state and invokes onBook exactly once over a page fallback', () => {
    context.state = 'bookable';
    render(<MobileStickyFooter fallbackAction={photoAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Request a time · no payment' }));
    expect(context.onBook).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: photoAction.label })).not.toBeInTheDocument();
  });

  it('preserves the manual quote action over a page fallback', () => {
    context.state = 'manual';
    render(<MobileStickyFooter fallbackAction={photoAction} />);
    expect(screen.getByRole('link', { name: 'Request a quote via WhatsApp' })).toHaveAttribute('href', context.waLink);
    expect(screen.queryByRole('link', { name: photoAction.label })).not.toBeInTheDocument();
  });

  it('keeps the shared footer suppressed when the wizard owns its own bar', () => {
    context.state = 'hidden';
    const { container } = render(<MobileStickyFooter fallbackAction={photoAction} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['/', '#quote'],
    ['/carpet-cleaning-london?utm_source=google#quote', '/carpet-cleaning-london#quote'],
    ['/sofa-cleaning-london', '/sofa-cleaning-london#quote'],
    ['/end-of-tenancy-cleaning-london', '/end-of-tenancy-cleaning-london#quote'],
  ])('preserves one calculator-validation dispatch on %s', (pathname, href) => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const quote = document.createElement('section');
    quote.id = 'quote';
    quote.scrollIntoView = vi.fn();
    document.body.appendChild(quote);
    const validate = vi.fn();
    document.addEventListener('vve:validate-book', validate);
    try {
      render(<MobileStickyFooter fallbackAction={{ href, label: 'Build my quote' }} />, pathname);
      fireEvent.click(screen.getByRole('button', { name: 'Get my price' }));
      expect(quote.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
      vi.advanceTimersByTime(501);
      expect(validate).toHaveBeenCalledTimes(1);
    } finally {
      quote.remove();
      document.removeEventListener('vve:validate-book', validate);
    }
  });

  it('takes process-page visitors to the service calculator instead of validating the current page', () => {
    render(
      <><CurrentRoute /><MobileStickyFooter fallbackAction={{ href: '/carpet-cleaning-london#quote', label: 'Get a carpet quote' }} /></>,
      '/how-we-clean-carpets',
    );
    const link = screen.getByRole('link', { name: 'Get a carpet quote' });
    expect(link).toHaveAttribute('href', '/carpet-cleaning-london#quote');
    fireEvent.click(link);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/carpet-cleaning-london#quote');
    expect(context.onBook).not.toHaveBeenCalled();
  });

  it('uses a native same-page fragment for repeat clicks and preserves campaign query data', () => {
    render(<Navbar primaryAction={{ href: '/carpet-cleaning-london#quote', label: 'Choose my rooms' }} />,
      '/carpet-cleaning-london?utm_source=google#quote');
    const link = screen.getByRole('link', { name: 'Choose my rooms' });
    expect(link).toHaveAttribute('href', '#quote');
    expect(link).not.toHaveAttribute('target');
  });

  it('does not discard an explicitly different destination query', () => {
    render(<PagePrimaryActionLink action={{ href: '/carpet-cleaning-london?selection=other#quote', label: 'Another quote' }} className="test" />,
      '/carpet-cleaning-london?utm_source=google');
    expect(screen.getByRole('link', { name: 'Another quote' })).toHaveAttribute('href', '/carpet-cleaning-london?selection=other#quote');
  });

  it('preserves the shared contact listener without adding duplicate tracking calls', () => {
    render(
      <div onClick={(event) => event.preventDefault()}>
        <ContactLinkTracking />
        <PagePrimaryActionLink action={photoAction} className="test-action">
          <span>Send my photos</span>
        </PagePrimaryActionLink>
      </div>,
    );
    fireEvent.click(screen.getByText('Send my photos'));
    expect(analytics.trackWhatsAppClick).toHaveBeenCalledTimes(1);
    expect(analytics.trackPhoneClick).not.toHaveBeenCalled();
    expect(analytics.trackEmailClick).not.toHaveBeenCalled();
  });
});
