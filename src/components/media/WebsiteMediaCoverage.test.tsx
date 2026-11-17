import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../../context/CookieConsentContext';
import type { PublishedReference } from '../../lib/managedGalleryMedia';
import { WEBSITE_MEDIA_POSITIONS } from '../../../admin/shared/mediaWebsitePositions.js';
import ManagedServiceHeroPhoto from './ManagedServiceHeroPhoto';
import LazyVideo from './LazyVideo';
import CarpetResultsSection from '../carpet/CarpetResultsSection';
import EotResultsSection from '../gallery/EotResultsSection';
import SofaGallerySection from '../sofa/SofaGallerySection';
import GalleryPage from '../../pages/GalleryPage';
import Services from '../Services';
import AfterBuildersPhoto, { AfterBuildersResults } from '../AfterBuildersPhoto';
import AreaServiceShowcase from '../areas/AreaServiceShowcase';
import { AREAS } from '../../data/areas';
import { getAreaShowcaseVideos } from '../../data/areaShowcase';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/mediaSupabase', () => ({ mediaSupabase: { rpc } }));
let published: PublishedReference[];
function row(key: string, kind: 'photo' | 'video' | 'before_after' = 'photo', role: 'primary' | 'before' | 'after' = 'primary'): PublishedReference {
  return { reference_key: `${key}-reference`, page_key: key, page_label: 'Registered page', component_label: 'Registered position', sort_order: 1,
    source_type: kind === 'before_after' ? 'gallery' : 'website', topic_key: null, slot_code: key, slot_kind: kind === 'before_after' ? kind : 'website', media_role: role,
    media_type: kind === 'video' ? 'video' : 'image', title: `New ${key}`, alt_text: `New ${key} ${role}`, delivery_url: kind === 'video' ? null : `https://media.example/${key}-${role}.jpg`, mux_playback_id: kind === 'video' ? 'new-public-video' : null };
}
const pair = (key: string) => [row(key, 'before_after', 'before'), row(key, 'before_after', 'after')];
const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter><CookieConsentProvider>{children}</CookieConsentProvider></MemoryRouter>;
beforeEach(() => {
  published = [];
  rpc.mockReset().mockImplementation(async () => ({ data: published, error: null }));
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

describe('real public media consumers', () => {
  it('gives a named service photo priority and restores the existing published result when cleared', async () => {
    published = [row('service-carpet-hero'), row('carpet-main-results')];
    render(<ManagedServiceHeroPhoto service="carpet" fallback={{ src: '/default.jpg', alt: 'Built in', caption: 'Built in' }} />);
    expect(await screen.findByAltText('New service-carpet-hero primary')).toHaveAttribute('src', 'https://media.example/service-carpet-hero-primary.jpg');
    published = [row('carpet-main-results')];
    fireEvent.focus(window);
    expect(await screen.findByAltText('New carpet-main-results primary')).toBeInTheDocument();
    published = [];
    fireEvent.focus(window);
    expect(await screen.findByAltText('Built in')).toHaveAttribute('src', '/default.jpg');
  });

  it('replaces a complete service pair and uses the same replacement in its full-size lightbox', async () => {
    published = pair('builtin-carpet-carpet-office');
    render(<CarpetResultsSection />, { wrapper });
    const button = await screen.findByRole('button', { name: 'View larger: New builtin-carpet-carpet-office before' });
    expect(within(button).getByRole('img')).toHaveAttribute('src', 'https://media.example/builtin-carpet-carpet-office-before.jpg');
    fireEvent.click(button);
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', 'https://media.example/builtin-carpet-carpet-office-before.jpg');
  });

  it('replaces original gallery tiles without adding another tile and updates the gallery lightbox', async () => {
    published = pair('builtin-carpet-carpet-office');
    render(<MemoryRouter initialEntries={['/gallery?category=carpet']}><CookieConsentProvider><GalleryPage /></CookieConsentProvider></MemoryRouter>);
    const buttons = await screen.findAllByRole('button', { name: 'View larger: New builtin-carpet-carpet-office after' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', 'https://media.example/builtin-carpet-carpet-office-after.jpg');
  });

  it('changes EOT rotating photos and sofa gallery photos in their actual service sections', async () => {
    const sofa = WEBSITE_MEDIA_POSITIONS.find(position => position.key.startsWith('builtin-sofa-upholstery-') && position.kind === 'photo')!;
    published = [row('builtin-end-of-tenancy-1'), row(sofa.key)];
    render(<><EotResultsSection /><SofaGallerySection /></>, { wrapper });
    const eot = await screen.findByRole('button', { name: /View larger: New builtin-end-of-tenancy-1 primary/ });
    fireEvent.click(eot);
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', 'https://media.example/builtin-end-of-tenancy-1-primary.jpg');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Close/ }));
    fireEvent.click(await screen.findByRole('button', { name: `View larger: New ${sofa.key} primary` }));
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', `https://media.example/${sofa.key}-primary.jpg`);
  });

  it('uses the managed Mux player for an original native clip, then restores native playback after clearing', async () => {
    const position = WEBSITE_MEDIA_POSITIONS.find(candidate => candidate.kind === 'video')!;
    const original = position.defaultMedia!;
    if (original.type !== 'video') throw new Error('Expected a video fixture');
    published = [row(position.key, 'video')];
    const { container } = render(<LazyVideo video={{ ...original, description: original.description || original.label }} className="aspect-[3/4]" />);
    fireEvent.click(await screen.findByRole('button', { name: `Play New ${position.key} primary` }));
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('https://player.mux.com/new-public-video');
    expect(container.querySelector('video')).toBeNull();
    published = [];
    fireEvent.focus(window);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('shows builders photos only after publication and keeps an independent homepage service-card selection', async () => {
    const { container } = render(<><AfterBuildersPhoto /><AfterBuildersResults /><Services onChoose={vi.fn()} /></>, { wrapper });
    expect(container.querySelector('[data-photo-slot]')).toBeNull();
    await act(async () => {});
    published = [row('after-builders-hero'), ...pair('after-builders-comparison'), row('homepage-service-after-builders')];
    fireEvent.focus(window);
    expect(await screen.findByAltText('New after-builders-hero primary')).toBeInTheDocument();
    expect(await screen.findByAltText('New after-builders-comparison before')).toBeInTheDocument();
    expect(container.querySelector('img[src="https://media.example/homepage-service-after-builders-primary.jpg"]')).not.toBeNull();
    published = [];
    fireEvent.focus(window);
    await waitFor(() => expect(container.querySelector('[data-photo-slot]')).toBeNull());
    expect(container.querySelector('img[src="https://media.example/homepage-service-after-builders-primary.jpg"]')).toBeNull();
  });

  it('updates a reused local-area clip, its poster and its visible caption', async () => {
    const area = AREAS.find(candidate => candidate.coverageConfirmed !== false)!;
    const [original] = getAreaShowcaseVideos(area.slug);
    const position = WEBSITE_MEDIA_POSITIONS.find(candidate => candidate.defaultMedia?.type === 'video' && candidate.defaultMedia.src === original.src)!;
    published = [row(position.key, 'video')];
    render(<AreaServiceShowcase area={area} />, { wrapper });
    expect(await screen.findByText(`New ${position.key}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Play New ${position.key} primary` }));
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('new-public-video');
  });
});
