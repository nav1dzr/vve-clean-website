import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SofaGallerySection from './SofaGallerySection';
import { SOFA_PHOTOS, SOFA_SUPPORTING_VIDEOS } from '../../data/sofaMedia';

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

beforeEach(() => sessionStorage.clear());

describe('the ten supporting photos', () => {
  it('renders all ten, each as its own openable tile', () => {
    render(<SofaGallerySection />);
    expect(screen.getAllByRole('button', { name: /^View larger:/ })).toHaveLength(10);
  });

  it('publishes no leather sofa, which this page says it does not clean', () => {
    render(<SofaGallerySection />);
    for (const img of screen.getAllByRole('img')) {
      expect(img.getAttribute('src')).not.toContain('sofa-gallery-11');
      expect((img.getAttribute('alt') ?? '').toLowerCase()).not.toContain('leather');
    }
  });

  it('puts the owner’s favourite first, whatever the shuffle produced', () => {
    render(<SofaGallerySection />);

    const tiles = screen.getAllByRole('button', { name: /^View larger:/ });
    expect(tiles[0]).toHaveAccessibleName(`View larger: ${SOFA_PHOTOS[0].alt}`);
  });

  it('gives every photo intrinsic width and height so nothing reflows on load', () => {
    render(<SofaGallerySection />);

    for (const img of screen.getAllByRole('img')) {
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
    }
  });

  it('references only web-safe derivatives', () => {
    render(<SofaGallerySection />);

    for (const img of screen.getAllByRole('img')) {
      expect(img.getAttribute('src')).toMatch(/^\/sofa_upholstery\/web\/gallery\/.+\.webp$/);
    }
  });

  it('lazy-loads everything except the lead image', () => {
    render(<SofaGallerySection />);

    const imgs = screen.getAllByRole('img');
    expect(imgs[0]).toHaveAttribute('loading', 'eager');
    for (const img of imgs.slice(1)) expect(img).toHaveAttribute('loading', 'lazy');
  });
});

describe('the shared lightbox', () => {
  it('opens on the tile that was clicked, not on index 0', async () => {
    const user = userEvent.setup();
    render(<SofaGallerySection />);

    const tiles = screen.getAllByRole('button', { name: /^View larger:/ });
    // Whatever the session shuffle produced, tile 4's own alt must appear.
    const expectedAlt = tiles[4].getAttribute('aria-label')!.replace('View larger: ', '');
    await user.click(tiles[4]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText(expectedAlt)).toBeInTheDocument();
  });

  it('reports the right position for the clicked tile', async () => {
    const user = userEvent.setup();
    render(<SofaGallerySection />);

    await user.click(screen.getAllByRole('button', { name: /^View larger:/ })[2]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Photo 3 of 10')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SofaGallerySection />);

    await user.click(screen.getAllByRole('button', { name: /^View larger:/ })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<SofaGallerySection />);

    await user.click(screen.getAllByRole('button', { name: /^View larger:/ })[0]);
    await user.keyboard('{ArrowRight}');

    expect(within(screen.getByRole('dialog')).getByText('Photo 2 of 10')).toBeInTheDocument();
  });
});

describe('the three supporting clips', () => {
  it('renders exactly three', () => {
    const { container } = render(<SofaGallerySection />);
    expect(container.querySelectorAll('video')).toHaveLength(3);
  });

  it('makes every one muted, looping, inline and autoplaying with a poster', () => {
    const { container } = render(<SofaGallerySection />);

    const videos = [...container.querySelectorAll('video')];
    expect(videos).toHaveLength(SOFA_SUPPORTING_VIDEOS.length);

    for (const video of videos) {
      expect(video).toHaveProperty('muted', true);
      expect(video).toHaveAttribute('loop');
      expect(video).toHaveAttribute('playsinline');
      expect(video).toHaveAttribute('autoplay');
      expect(video.getAttribute('poster')).toMatch(/-poster\.jpg$/);
      expect(video.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('never publishes a .MOV source', () => {
    const { container } = render(<SofaGallerySection />);

    for (const video of container.querySelectorAll('video')) {
      expect(video.getAttribute('poster')).not.toMatch(/\.mov$/i);
    }
    expect(container.innerHTML).not.toMatch(/\.mov\b/i);
  });

  it('does not expose clips as lightbox photos', async () => {
    const user = userEvent.setup();
    render(<SofaGallerySection />);

    // 10 photo tiles and no more: a clip must never open the photo overlay.
    const openers = screen.getAllByRole('button', { name: /^View larger:/ });
    expect(openers).toHaveLength(10);

    await user.click(openers[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /video/i })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/^Photo \d+ of 10$/)).toBeInTheDocument();
  });
});

describe('mobile layout containment', () => {
  it('lets every tile and clip shrink with its column', () => {
    const { container } = render(<SofaGallerySection />);

    const grids = [...container.querySelectorAll('.grid')];
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) expect(grid.className).toContain('[&>*]:min-w-0');

    for (const video of container.querySelectorAll('video')) {
      const stage = video.parentElement!;
      expect(stage.className).toContain('min-w-0');
      expect(stage.className).not.toMatch(/\bw-\[\d+px\]/);
    }
  });
});
