// The Sofa proof section is wired to the shared lightbox before the photos
// exist, so the owner can drop an approved set into the manifest and have it
// work — no second code change, no risk of the wiring being forgotten.
//
// The manifest is mocked here to stand in for that future set. The companion
// file (SofaResultsSection.test.tsx) covers the real, current state, where
// every slot is reserved and nothing is clickable.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

beforeAll(() => {
  // RotatingResults reads prefers-reduced-motion on mount.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as never;
  }
});

const PAIR = {
  type: 'before-after' as const,
  id: 'sofa-1',
  label: 'Fabric sofa',
  before: '/sofa/1-before.jpg',
  after: '/sofa/1-after.jpg',
  beforeAlt: 'Fabric three-seater before cleaning',
  afterAlt: 'The same three-seater after cleaning',
};

const VIDEO = {
  type: 'video' as const,
  id: 'sofa-v1',
  label: 'Extraction clip',
  src: '/sofa/clip.mp4',
  poster: '/sofa/clip.jpg',
};

const PHOTO = {
  type: 'photo' as const,
  id: 'sofa-p1',
  label: 'Armchair',
  src: '/sofa/p1.jpg',
  alt: 'Armchair photographed after cleaning',
};

vi.mock('../../data/galleryMedia', () => ({
  GALLERY_MEDIA: { 'end-of-tenancy': [], carpet: [], 'sofa-upholstery': [PAIR, VIDEO, PHOTO] },
  GALLERY_CATEGORIES: [{ key: 'sofa-upholstery', label: 'Sofa & Upholstery' }],
}));

const { default: SofaResultsSection } = await import('./SofaResultsSection');

function renderSection() {
  return render(
    <MemoryRouter>
      <SofaResultsSection />
    </MemoryRouter>,
  );
}

const dialog = () => screen.getByRole('dialog');

describe('once approved sofa photos exist', () => {
  it('renders the real tiles in place of the reserved slots', () => {
    renderSection();

    expect(screen.getByAltText(PAIR.beforeAlt)).toBeInTheDocument();
    expect(screen.getByAltText(PHOTO.alt)).toBeInTheDocument();
    // Two before/after slots and two video slots are still reserved.
    expect(screen.getAllByRole('img', { name: /Before and after —/ })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: /Short clip —/ })).toHaveLength(2);
  });

  it('opens the clicked half at the right position', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: `View larger: ${PAIR.beforeAlt}` }));

    // Both halves of the pair, then the rotating photo.
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
    expect(within(dialog()).getByAltText(PAIR.beforeAlt)).toBeInTheDocument();
    expect(within(dialog()).getByText('Fabric sofa — before')).toBeInTheDocument();
  });

  it('walks the section in reading order', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: `View larger: ${PAIR.beforeAlt}` }));
    const next = within(dialog()).getByRole('button', { name: 'Next photo' });

    await user.click(next);
    expect(within(dialog()).getByAltText(PAIR.afterAlt)).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog()).getByText('Photo 3 of 3')).toBeInTheDocument();
    expect(within(dialog()).getByAltText(PHOTO.alt)).toBeInTheDocument();
  });

  it('opens the rotating photo directly from the carousel', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: `View larger: ${PHOTO.alt}` }));
    expect(within(dialog()).getByText('Photo 3 of 3')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: `View larger: ${PAIR.beforeAlt}` }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still does not make the remaining reserved slots clickable', () => {
    renderSection();

    const triggers = screen.getAllByRole('button', { name: /^View larger:/ });
    // Exactly the two real halves plus the one real rotating photo.
    expect(triggers).toHaveLength(3);
    for (const t of triggers) {
      expect(t.getAttribute('aria-label')).not.toMatch(/Genuine sofa results/);
    }
  });
});
