import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import AppRoutes from '../AppRoutes';
import { CookieConsentProvider } from '../context/CookieConsentContext';

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

const renderAt = (path: string, node: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>{node}</CookieConsentProvider>
    </MemoryRouter>,
  );

describe('the branded Not Found page', () => {
  it('says plainly that the page was not found', () => {
    renderAt('/nope', <NotFoundPage />);
    expect(screen.getByRole('heading', { level: 1, name: /couldn.t find that page/i }))
      .toBeInTheDocument();
    expect(screen.getByText('Error 404')).toBeInTheDocument();
  });

  it('carries the VVE wordmark', () => {
    renderAt('/nope', <NotFoundPage />);
    expect(screen.getAllByText('VVE Clean').length).toBeGreaterThan(0);
  });

  it('offers a route back to Home, Services, Pricing, Contact and a quote', () => {
    renderAt('/nope', <NotFoundPage />);

    const popular = screen.getByRole('navigation', { name: 'Popular pages' });
    expect(within(popular).getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/');
    expect(within(popular).getByRole('link', { name: /Services/ })).toHaveAttribute('href', '/#services');
    expect(within(popular).getByRole('link', { name: /Pricing/ })).toHaveAttribute('href', '/pricing');
    expect(within(popular).getByRole('link', { name: /Contact/ })).toHaveAttribute('href', '/#contact');

    expect(screen.getByRole('link', { name: /Get a quote/i })).toHaveAttribute('href', '/#quote');
  });

  it('gives every action a 44px touch target', () => {
    const { container } = renderAt('/nope', <NotFoundPage />);
    for (const link of container.querySelectorAll('main a')) {
      expect(link.className).toContain('min-h-[44px]');
    }
  });

  it('lets its cards shrink instead of forcing horizontal overflow', () => {
    const { container } = renderAt('/nope', <NotFoundPage />);
    const grid = container.querySelector('main ul.grid');
    expect(grid?.className).toContain('[&>*]:min-w-0');
  });
});

describe('the router catch-all', () => {
  it('renders the Not Found page for an unknown path', () => {
    // The server status comes from dist/404.html; this is the in-app half, so a
    // bad link clicked inside the site does not land on a blank screen.
    renderAt('/this-route-does-not-exist', <AppRoutes />);
    expect(screen.getByRole('heading', { level: 1, name: /couldn.t find that page/i }))
      .toBeInTheDocument();
  });

  it('still renders real routes rather than swallowing them', () => {
    renderAt('/pricing', (
      <Routes>
        <Route path="/pricing" element={<p>real pricing page</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    ));
    expect(screen.getByText('real pricing page')).toBeInTheDocument();
    expect(screen.queryByText('Error 404')).not.toBeInTheDocument();
  });
});
