import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GalleryPage from './GalleryPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { GALLERY_MEDIA } from '../data/galleryMedia';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CookieConsentProvider>
        <GalleryPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// The owner is actively reorganising the photo/video folders behind this
// page (old paths retired, new ones unfinished). Until an approved set is
// handed back, every category manifest must stay empty — no auto-scanned or
// hard-coded media path may sneak back in.
describe('GalleryPage — categories, deep links, empty states, keyboard nav', () => {
  it('ships with every category manifest empty (no current or unfinished media paths referenced)', () => {
    expect(GALLERY_MEDIA['end-of-tenancy']).toEqual([]);
    expect(GALLERY_MEDIA.carpet).toEqual([]);
    expect(GALLERY_MEDIA['sofa-upholstery']).toEqual([]);
  });

  it('defaults to the End of Tenancy tab and shows an honest, category-specific empty state', () => {
    renderAt('/gallery');

    expect(screen.getByRole('tab', { name: 'End of Tenancy' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText('Our End of Tenancy results library is being organised and will be added here shortly.'),
    ).toBeInTheDocument();
    // Never implies real jobs are already on display.
    expect(screen.queryByText(/real jobs/i)).not.toBeInTheDocument();
  });

  it('deep-links directly into the Carpet category via a query param, with its own empty state', () => {
    renderAt('/gallery?category=carpet');

    expect(screen.getByRole('tab', { name: 'Carpet' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText('Our Carpet results library is being organised and will be added here shortly.'),
    ).toBeInTheDocument();
  });

  it('deep-links into Sofa & Upholstery via a query param, with its own empty state', () => {
    renderAt('/gallery?category=sofa-upholstery');

    expect(screen.getByRole('tab', { name: 'Sofa & Upholstery' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText('Our Sofa & Upholstery results library is being organised and will be added here shortly.'),
    ).toBeInTheDocument();
  });

  it('shows the real Instagram link but never a self-referential "View full Gallery" link', () => {
    renderAt('/gallery?category=carpet');

    expect(screen.getByRole('link', { name: 'Follow VVE Clean on Instagram' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/vve__clean',
    );
    expect(screen.queryByRole('link', { name: 'View full Gallery' })).not.toBeInTheDocument();
  });

  it('supports left/right arrow key navigation between tabs', async () => {
    const user = userEvent.setup();
    renderAt('/gallery');

    const eotTab = screen.getByRole('tab', { name: 'End of Tenancy' });
    eotTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Carpet' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Carpet' })).toHaveFocus();
  });

  it('supports Home/End key navigation to jump to the first/last tab', async () => {
    const user = userEvent.setup();
    renderAt('/gallery?category=carpet');

    const carpetTab = screen.getByRole('tab', { name: 'Carpet' });
    carpetTab.focus();
    await user.keyboard('{End}');

    expect(screen.getByRole('tab', { name: 'Sofa & Upholstery' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Sofa & Upholstery' })).toHaveFocus();
  });
});
