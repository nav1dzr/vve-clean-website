import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManagedServiceHeroPhoto from './ManagedServiceHeroPhoto';
import ManagedServiceMedia from './ManagedServiceMedia';
import GalleryPage from '../../pages/GalleryPage';
import CarpetCleaningPage from '../../pages/CarpetCleaningPage';
import SofaCleaningPage from '../../pages/SofaCleaningPage';
import EndOfTenancyPage from '../../pages/EndOfTenancyPage';
import { CookieConsentProvider } from '../../context/CookieConsentContext';
import { SERVICE_HERO_PLACEMENTS, type PublishedReference } from '../../lib/managedGalleryMedia';
import type { GalleryCategory } from '../../data/galleryMedia';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/mediaSupabase', () => ({ mediaSupabase: { rpc } }));

const fallback = { src: '/images/carpet-cleaning-hero.webp', alt: 'Curated cleaning photograph', caption: 'Curated cleaning caption' };
let published: PublishedReference[];

function photo(service: GalleryCategory, version: string, pageKey: string): PublishedReference {
  return {
    reference_key: `${pageKey}-first`, page_key: pageKey, page_label: service,
    component_label: 'First result', sort_order: 1, source_type: 'gallery', topic_key: service,
    slot_code: 'PHOTO01', slot_kind: 'photo', media_role: 'primary', media_type: 'image',
    title: `${version} ${service} result`, alt_text: `${version} ${service} photograph`,
    delivery_url: `https://media.example/${service}/{width}/${version}.jpg`, mux_playback_id: null,
  };
}

function renderPlacements(service: GalleryCategory) {
  return render(<MemoryRouter initialEntries={[`/gallery?category=${service}`]}>
    <CookieConsentProvider>
      <div data-testid="hero"><ManagedServiceHeroPhoto service={service} fallback={fallback} /></div>
      <div data-testid="results"><ManagedServiceMedia pageKey={SERVICE_HERO_PLACEMENTS[service].results} /></div>
      <div data-testid="gallery"><GalleryPage /></div>
    </CookieConsentProvider>
  </MemoryRouter>);
}

beforeEach(() => {
  published = [];
  rpc.mockReset().mockImplementation(() => Promise.resolve({ data: published, error: null }));
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (media: string) => ({
    matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }) });
});

describe('published result reuse in service heroes', () => {
  it.each([
    ['carpet', CarpetCleaningPage],
    ['sofa-upholstery', SofaCleaningPage],
    ['end-of-tenancy', EndOfTenancyPage],
  ] as const)('connects the actual %s landing-page hero to its assigned result', async (service, Page) => {
    published = [photo(service, 'Published', SERVICE_HERO_PLACEMENTS[service].results)];
    const { container } = render(<MemoryRouter><CookieConsentProvider><Page /></CookieConsentProvider></MemoryRouter>);
    const hero = within(container.querySelector('.service-hero') as HTMLElement);
    expect(await hero.findByRole('img', { name: `Published ${service} photograph` })).toHaveAttribute('src', `https://media.example/${service}/1200/Published.jpg`);
    expect(hero.getByText(`Published ${service} result`)).toBeInTheDocument();
    if (service === 'end-of-tenancy') {
      expect(hero.queryByText(/See the full before-and-after pair below/)).not.toBeInTheDocument();
      expect(hero.getByText('Cleaning does not repair existing scratches or wear.')).toBeInTheDocument();
    }
  });

  it.each<GalleryCategory>(['carpet', 'sofa-upholstery', 'end-of-tenancy'])('refreshes a shared %s photo across hero, results and the actual gallery', async service => {
    const placement = SERVICE_HERO_PLACEMENTS[service];
    published = [photo(service, 'Original', placement.gallery), photo(service, 'Original', placement.results)];
    renderPlacements(service);
    for (const area of ['hero', 'results', 'gallery']) {
      const image = await within(screen.getByTestId(area)).findByRole('img', { name: `Original ${service} photograph` });
      expect(image).toHaveAttribute('src', `https://media.example/${service}/1200/Original.jpg`);
    }
    published = [photo(service, 'Replacement', placement.gallery), photo(service, 'Replacement', placement.results)];
    fireEvent.focus(window);
    for (const area of ['hero', 'results', 'gallery']) {
      const target = within(screen.getByTestId(area));
      const image = await target.findByRole('img', { name: `Replacement ${service} photograph` });
      expect(image).toHaveAttribute('src', `https://media.example/${service}/1200/Replacement.jpg`);
      expect(target.queryByRole('img', { name: `Original ${service} photograph` })).not.toBeInTheDocument();
      expect(target.getByText(`Replacement ${service} result`)).toBeInTheDocument();
    }
    expect(rpc).toHaveBeenCalledWith('public_media_references');
    expect(rpc).toHaveBeenCalledTimes(2); // One shared fetch for each initial load/focus refresh.
  });

  it('uses only the after image of a complete first pair, with its published description', async () => {
    const base = photo('carpet', 'Pair', 'carpet-main-results');
    published = (['before', 'after'] as const).map(role => ({
      ...base, slot_code: 'BA01', slot_kind: 'before_after', media_role: role,
      delivery_url: `https://media.example/${role}.jpg`, alt_text: `Carpet ${role} cleaning`,
    }));
    render(<ManagedServiceHeroPhoto service="carpet" fallback={fallback} />);
    expect(await screen.findByRole('img', { name: 'Carpet after cleaning' })).toHaveAttribute('src', 'https://media.example/after.jpg');
    expect(screen.queryByRole('img', { name: 'Carpet before cleaning' })).not.toBeInTheDocument();
    expect(screen.getByText('Pair carpet result')).toBeInTheDocument();
  });

  it('keeps video in the results and retains the curated hero instead of promoting a later photo', async () => {
    const video: PublishedReference = { ...photo('carpet', 'Clip', 'carpet-main-results'), slot_kind: 'video', media_type: 'video', delivery_url: null, mux_playback_id: 'test-playback' };
    published = [video, { ...photo('carpet', 'Later', 'carpet-main-results'), reference_key: 'second', sort_order: 2 }];
    render(<><ManagedServiceHeroPhoto service="carpet" fallback={fallback} /><ManagedServiceMedia pageKey="carpet-main-results" /></>);
    expect(await screen.findByRole('button', { name: 'Play Clip carpet photograph' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: fallback.alt })).toHaveAttribute('src', fallback.src);
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('uses the curated image and caption on image failure, then accepts a newly published replacement', async () => {
    published = [photo('carpet', 'Broken', 'carpet-main-results')];
    render(<ManagedServiceHeroPhoto service="carpet" fallback={fallback} />);
    fireEvent.error(await screen.findByRole('img', { name: 'Broken carpet photograph' }));
    expect(screen.getByRole('img', { name: fallback.alt })).toHaveAttribute('src', fallback.src);
    expect(screen.getByText(fallback.caption)).toBeInTheDocument();
    expect(screen.queryByText('Broken carpet result')).not.toBeInTheDocument();
    published = [photo('carpet', 'Working', 'carpet-main-results')];
    fireEvent.focus(window);
    expect(await screen.findByRole('img', { name: 'Working carpet photograph' })).toHaveAttribute('src', 'https://media.example/carpet/1200/Working.jpg');
    published = [];
    fireEvent.focus(window);
    expect(await screen.findByRole('img', { name: fallback.alt })).toHaveAttribute('src', fallback.src);
    expect(screen.queryByRole('img', { name: 'Working carpet photograph' })).not.toBeInTheDocument();
  });

  it('withholds a half-pair and keeps the local fallback when the feed is empty or unavailable', async () => {
    published = [{ ...photo('carpet', 'Incomplete', 'carpet-main-results'), slot_kind: 'before_after', media_role: 'after' }];
    render(<ManagedServiceHeroPhoto service="carpet" fallback={fallback} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('img', { name: fallback.alt })).toBeInTheDocument();
    published = [];
    fireEvent.focus(window);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('img', { name: fallback.alt })).toBeInTheDocument();
    rpc.mockRejectedValueOnce(new Error('Unavailable'));
    fireEvent.focus(window);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('img', { name: fallback.alt })).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img', { name: fallback.alt }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cleaning results in the gallery/i })).toHaveAttribute('href', '/gallery');
  });
});
