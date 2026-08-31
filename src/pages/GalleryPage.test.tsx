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

// Each category is populated from the owner's approved local media sets.
describe('GalleryPage — categories, deep links, empty states, keyboard nav', () => {
  it('ships all three categories populated from the approved sets', () => {
    expect(GALLERY_MEDIA['end-of-tenancy']).toHaveLength(16);
    expect(GALLERY_MEDIA['end-of-tenancy'].filter((i) => i.type === 'before-after')).toHaveLength(3);
    expect(GALLERY_MEDIA['end-of-tenancy'].filter((i) => i.type === 'photo')).toHaveLength(13);
    expect(GALLERY_MEDIA.carpet).toHaveLength(7);
    expect(GALLERY_MEDIA.carpet.filter((i) => i.type === 'before-after')).toHaveLength(3);
    expect(GALLERY_MEDIA.carpet.filter((i) => i.type === 'video')).toHaveLength(4);

    // Sofa was the last empty placeholder. The owner's set landed as 4 approved
    // before/after pairs, 11 supporting photos and 4 clips.
    const sofa = GALLERY_MEDIA['sofa-upholstery'];
    expect(sofa.filter((i) => i.type === 'before-after')).toHaveLength(4);
    expect(sofa.filter((i) => i.type === 'photo')).toHaveLength(10);
    expect(sofa.filter((i) => i.type === 'video')).toHaveLength(4);
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

  it('shows the real Sofa & Upholstery set instead of the old empty state', () => {
    renderAt('/gallery?category=sofa-upholstery');

    expect(
      screen.queryByText('Our Sofa & Upholstery results library is being organised and will be added here shortly.'),
    ).not.toBeInTheDocument();
    // The same four pairs the Sofa landing page features — one manifest, so the
    // two can never drift apart.
    expect(screen.getByText('Fabric sofa seat')).toBeInTheDocument();
    expect(screen.getByText('Grey corner sofa')).toBeInTheDocument();
    expect(screen.getByText('Dining chair seat pad')).toBeInTheDocument();
    expect(screen.getByText('Dining chair cleaning in progress')).toBeInTheDocument();
  });

  it('deep-links into Sofa & Upholstery via a query param', () => {
    renderAt('/gallery?category=sofa-upholstery');

    expect(screen.getByRole('tab', { name: 'Sofa & Upholstery' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Cleaning a velvet sofa')).toBeInTheDocument();
  });

  it('shows the real Instagram link but never a self-referential "View full Gallery" link', () => {
    renderAt('/gallery?category=carpet');

    expect(screen.getByRole('link', { name: 'Follow VVE Clean on Instagram' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/vve__clean',
    );
    expect(screen.queryByRole('link', { name: 'View full Gallery' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Follow VVE Clean on Facebook' })).toHaveAttribute(
      'href',
      'https://www.facebook.com/share/1LXXHgnhvc/',
    );
    expect(screen.getByRole('link', { name: 'See VVE Clean on Google' })).toHaveAttribute(
      'href',
      'https://g.page/r/CYDRQCaICK7vEAE/review',
    );
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
