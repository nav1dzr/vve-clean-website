import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import GalleryPage from './GalleryPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { GALLERY_MEDIA, type GalleryCategory, type GalleryItem } from '../data/galleryMedia';

const { managed } = vi.hoisted(() => ({ managed: vi.fn() }));
vi.mock('../lib/managedGalleryMedia', async (original) => ({
  ...(await original<typeof import('../lib/managedGalleryMedia')>()),
  useManagedGalleryMedia: managed,
}));

beforeEach(() => {
  managed.mockReturnValue({ 'end-of-tenancy': [], carpet: [], 'sofa-upholstery': [] });
});

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.search}</output><button onClick={() => navigate(1)}>Next history entry</button></>;
}

function renderGallery(entries: string[]) {
  return render(<MemoryRouter initialEntries={entries} initialIndex={0}><CookieConsentProvider>
    <GalleryPage /><NavigationProbe />
  </CookieConsentProvider></MemoryRouter>);
}

describe('Gallery browsing', () => {
  it('filters photos and keeps the lightbox ordered within that selection', async () => {
    const user = userEvent.setup();
    renderGallery(['/gallery?category=end-of-tenancy&source=service']);
    await user.click(screen.getByRole('button', { name: 'Photos (13)' }));
    expect(screen.getByRole('button', { name: 'Photos (13)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent('category=end-of-tenancy&source=service&type=photo');
    expect(screen.queryByText('Kitchen hob')).not.toBeInTheDocument();
    const photos = GALLERY_MEDIA['end-of-tenancy'].filter((item) => item.type === 'photo');
    await user.click(screen.getByRole('button', { name: `View larger: ${photos[0].alt}` }));
    const dialog = screen.getByRole('dialog', { name: 'End of Tenancy photos' });
    expect(within(dialog).getByText('Photo 1 of 13')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', photos[1].src);
  });

  it('deep-links comparisons without changing the before/after photo identities', async () => {
    const user = userEvent.setup();
    renderGallery(['/gallery?category=carpet&type=before-after']);
    expect(screen.getByRole('button', { name: 'Comparisons (3)' })).toHaveAttribute('aria-pressed', 'true');
    const pair = GALLERY_MEDIA.carpet.find((item) => item.type === 'before-after')!;
    if (pair.type !== 'before-after') throw new Error('Expected approved pair');
    await user.click(screen.getByRole('button', { name: `View larger: ${pair.afterAlt}` }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Photo 2 of 6')).toBeInTheDocument();
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', pair.after);
  });

  it('keeps clips unloaded until the visitor chooses Play', async () => {
    const user = userEvent.setup();
    const { container } = renderGallery(['/gallery?category=carpet&type=video']);
    const clips = GALLERY_MEDIA.carpet.filter((item) => item.type === 'video');
    expect(screen.getByRole('button', { name: 'Videos (4)' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('video, iframe')).toBeNull();
    await user.click(screen.getByRole('button', { name: `Play ${clips[0].label}` }));
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('video')).toHaveAttribute('src', clips[0].src);
    expect(container.querySelector('video')).toHaveAttribute('controls');
  });

  it('offers a useful return from an empty format and retains the correct quote link', async () => {
    const user = userEvent.setup();
    renderGallery(['/gallery?category=end-of-tenancy&type=video']);
    expect(screen.getByText('There are no videos in this collection yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get an end of tenancy quote' })).toHaveAttribute('href', '/end-of-tenancy-cleaning-london#quote');
    await user.click(screen.getByRole('button', { name: 'Show all results' }));
    expect(screen.getByText('Kitchen hob')).toBeInTheDocument();
    expect(screen.getByTestId('location')).not.toHaveTextContent('type=');
  });

  it('follows legacy hash links and changes category and format on history navigation', async () => {
    const user = userEvent.setup();
    renderGallery(['/gallery#sofa-upholstery', '/gallery?category=carpet&type=video']);
    expect(screen.getByRole('tab', { name: 'Sofa & Upholstery' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Next history entry' }));
    expect(screen.getByRole('tab', { name: 'Carpet' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Videos (4)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the first published CRM position featured and loads the remaining results on request', async () => {
    const user = userEvent.setup();
    const entries: GalleryItem[] = Array.from({ length: 21 }, (_, i) => ({
      type: 'photo', id: `managed-${i}`, label: `Published photo ${i + 1}`, alt: `Published gallery image ${i + 1}`,
      src: `/approved-${i}.webp`, fullSrc: `/approved-full-${i}.webp`,
    }));
    const media: Record<GalleryCategory, GalleryItem[]> = { 'end-of-tenancy': [], carpet: entries, 'sofa-upholstery': [] };
    managed.mockReturnValue(media);
    renderGallery(['/gallery?category=carpet']);
    expect(screen.getByRole('button', { name: 'All results (28)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Published photo 21')).not.toBeInTheDocument();
    const firstPhoto = screen.getByRole('button', { name: 'View larger: Published gallery image 1' });
    await user.click(firstPhoto);
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', '/approved-full-0.webp');
    await user.click(screen.getByRole('button', { name: 'Close photo viewer' }));
    await user.click(screen.getByRole('button', { name: 'Show more results (8 remaining)' }));
    expect(screen.getByText('Published photo 21')).toBeInTheDocument();
    expect(screen.getByText('Office carpet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show more results/ })).not.toBeInTheDocument();
  });
});
