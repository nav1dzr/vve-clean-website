// The lightbox, wired into the three routed surfaces that carry genuine
// photographs. Unit behaviour lives in PhotoLightbox.test.tsx; this file pins
// that each page hands it the right photo list, so Previous/Next walks what
// the visitor can actually see and the position text matches the page.

import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CarpetCleaningPage from './CarpetCleaningPage';
import EndOfTenancyPage from './EndOfTenancyPage';
import GalleryPage from './GalleryPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import {
  CARPET_FEATURED_BEFORE_AFTER,
  EOT_FEATURED_BEFORE_AFTER,
  EOT_ROTATING_PHOTOS,
  GALLERY_MEDIA,
} from '../data/galleryMedia';

beforeAll(() => {
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

function renderPage(node: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentProvider>{node}</CookieConsentProvider>
    </MemoryRouter>,
  );
}

const dialog = () => screen.getByRole('dialog');

describe('Carpet page — real before/after photos open full size', () => {
  it('opens the exact half that was clicked, and counts every half', async () => {
    const user = userEvent.setup();
    renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');

    const first = CARPET_FEATURED_BEFORE_AFTER[0];
    await user.click(screen.getByRole('button', { name: `View larger: ${first.beforeAlt}` }));

    expect(within(dialog()).getByAltText(first.beforeAlt)).toBeInTheDocument();
    // Six halves across the three approved pairs.
    expect(within(dialog()).getByText(`Photo 1 of ${CARPET_FEATURED_BEFORE_AFTER.length * 2}`))
      .toBeInTheDocument();

    // Next moves to the "after" of the same pair, matching reading order.
    await user.click(within(dialog()).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog()).getByAltText(first.afterAlt)).toBeInTheDocument();
  });

  it('does not turn the paired video clips into lightbox triggers', () => {
    renderPage(<CarpetCleaningPage />, '/carpet-cleaning-london');
    const triggers = screen.getAllByRole('button', { name: /^View larger:/ });
    expect(triggers).toHaveLength(CARPET_FEATURED_BEFORE_AFTER.length * 2);
  });
});

describe('End of tenancy page — before/after and rotating photos both open', () => {
  it('opens a before/after half at the right position', async () => {
    const user = userEvent.setup();
    renderPage(<EndOfTenancyPage />, '/end-of-tenancy-cleaning-london');

    const first = EOT_FEATURED_BEFORE_AFTER[0];
    await user.click(screen.getAllByRole('button', { name: `View larger: ${first.beforeAlt}` })[0]);

    const total = EOT_FEATURED_BEFORE_AFTER.length * 2 + EOT_ROTATING_PHOTOS.length;
    expect(within(dialog()).getByText(`Photo 1 of ${total}`)).toBeInTheDocument();
    expect(within(dialog()).getByAltText(first.beforeAlt)).toBeInTheDocument();
  });

  it('opens the rotating carousel photo after the before/after halves', async () => {
    const user = userEvent.setup();
    renderPage(<EndOfTenancyPage />, '/end-of-tenancy-cleaning-london');

    const firstRotating = EOT_ROTATING_PHOTOS[0];
    await user.click(screen.getByRole('button', { name: `View larger: ${firstRotating.alt}` }));

    const offset = EOT_FEATURED_BEFORE_AFTER.length * 2;
    const total = offset + EOT_ROTATING_PHOTOS.length;
    expect(within(dialog()).getByText(`Photo ${offset + 1} of ${total}`)).toBeInTheDocument();
  });

  it('caps the automatic rotating gallery at 15 files', () => {
    // The folder is scanned at build time, so the cap is the only thing
    // standing between a full upload and an unbounded page.
    expect(EOT_ROTATING_PHOTOS.length).toBeLessThanOrEqual(15);
  });
});

describe('Gallery page — the count spans the whole category', () => {
  it('numbers photos across before/after halves and single photos together', async () => {
    const user = userEvent.setup();
    renderPage(<GalleryPage />, '/gallery?category=end-of-tenancy');

    const items = GALLERY_MEDIA['end-of-tenancy'];
    const total = items.reduce(
      (n, i) => n + (i.type === 'before-after' ? 2 : i.type === 'photo' ? 1 : 0),
      0,
    );

    const firstPhoto = EOT_ROTATING_PHOTOS[0];
    await user.click(screen.getByRole('button', { name: `View larger: ${firstPhoto.alt}` }));

    // The gallery intentionally interleaves evidence types. Derive the index
    // from the visible manifest order instead of assuming every pair comes
    // before every supporting photo.
    let expectedIndex = 0;
    for (const item of items) {
      if (item.id === firstPhoto.id) break;
      if (item.type === 'before-after') expectedIndex += 2;
      else if (item.type === 'photo') expectedIndex += 1;
    }
    expect(within(dialog()).getByText(`Photo ${expectedIndex + 1} of ${total}`)).toBeInTheDocument();
    expect(within(dialog()).getByAltText(firstPhoto.alt)).toBeInTheDocument();
  });

  it('numbers the Sofa category across its pairs and photos, skipping the clips', async () => {
    // This replaces an assertion that Sofa & Upholstery had nothing to enlarge.
    // That was true while the category was an intentional empty placeholder;
    // the owner's set has since been approved, so the meaningful check is that
    // the count spans photos only — the four clips must not be numbered as
    // lightbox entries, or Next would step onto a blank frame.
    const user = userEvent.setup();
    renderPage(<GalleryPage />, '/gallery?category=sofa-upholstery');

    await user.click(screen.getByRole('tab', { name: 'Sofa & Upholstery' }));

    const items = GALLERY_MEDIA['sofa-upholstery'];
    const total = items.reduce(
      (n, i) => n + (i.type === 'before-after' ? 2 : i.type === 'photo' ? 1 : 0),
      0,
    );
    // 4 pairs (8 halves) + 10 photos, and none of the 4 videos.
    expect(total).toBe(18);

    const openers = screen.getAllByRole('button', { name: /^View larger:/ });
    expect(openers).toHaveLength(total);

    await user.click(openers[0]);
    expect(within(dialog()).getByText(`Photo 1 of ${total}`)).toBeInTheDocument();
  });
});
