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

// End of Tenancy ships the owner-approved photo set (3 before/after pairs + 13
// supporting photos = 16 items). Carpet now ships its own approved before/after
// pairs. Sofa & Upholstery remains an empty placeholder — the owner is still
// organising that folder, so nothing unapproved is referenced until a final set
// is supplied.
describe('GalleryPage — categories, deep links, empty states, keyboard nav', () => {
  it('ships End of Tenancy and Carpet populated, with Sofa still empty', () => {
    expect(GALLERY_MEDIA['end-of-tenancy']).toHaveLength(16);
    expect(GALLERY_MEDIA['end-of-tenancy'].filter((i) => i.type === 'before-after')).toHaveLength(3);
    expect(GALLERY_MEDIA['end-of-tenancy'].filter((i) => i.type === 'photo')).toHaveLength(13);
    expect(GALLERY_MEDIA.carpet).toHaveLength(3);
    expect(GALLERY_MEDIA.carpet.every((i) => i.type === 'before-after')).toBe(true);
    expect(GALLERY_MEDIA['sofa-upholstery']).toEqual([]);
  });

  it('has no duplicate ids between the before/after source pairs and the combined comparison photos', () => {
    const ids = GALLERY_MEDIA['end-of-tenancy'].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaults to the End of Tenancy tab and shows the real, approved photos', () => {
    renderAt('/gallery');

    expect(screen.getByRole('tab', { name: 'End of Tenancy' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Kitchen hob')).toBeInTheDocument();
    expect(screen.getByText('Oven')).toBeInTheDocument();
    expect(screen.getByText('Shower')).toBeInTheDocument();
    expect(
      screen.queryByText('Our End of Tenancy results library is being organised and will be added here shortly.'),
    ).not.toBeInTheDocument();
  });

  it('deep-links directly into the Carpet category and shows its real pairs', () => {
    renderAt('/gallery?category=carpet');

    expect(screen.getByRole('tab', { name: 'Carpet' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.queryByText('Our Carpet results library is being organised and will be added here shortly.'),
    ).not.toBeInTheDocument();
    // The same three pairs the Carpet landing page features — one manifest,
    // so the two can never drift apart.
    expect(screen.getByText('Office carpet')).toBeInTheDocument();
    expect(screen.getByText('Blue bedroom carpet')).toBeInTheDocument();
    expect(screen.getByText('Brown carpet')).toBeInTheDocument();
  });

  it('still shows the honest empty state for Sofa & Upholstery', () => {
    renderAt('/gallery?category=sofa-upholstery');

    expect(
      screen.getByText('Our Sofa & Upholstery results library is being organised and will be added here shortly.'),
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
