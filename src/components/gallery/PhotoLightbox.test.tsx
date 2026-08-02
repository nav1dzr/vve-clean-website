// The shared lightbox, and the rule that placeholders never open one.
//
// These cover the parts a customer would actually notice if they broke:
// getting in, getting out, getting back to where they were, and not being
// offered an enlargement that does not exist.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PhotoLightbox from './PhotoLightbox';
import { toLightboxPhotos, useLightbox } from './useLightbox';
import BeforeAfterTile from './BeforeAfterTile';
import ServiceProofSection from './ServiceProofSection';
import type { GalleryItem } from '../../data/galleryMedia';

beforeAll(() => {
  // jsdom has no rAF by default in some setups; useLightbox defers focus
  // restoration through it.
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as never;
  }
});

beforeEach(() => {
  document.body.style.overflow = '';
});

const PHOTOS = [
  { src: '/a.jpg', alt: 'Alt for photo A', caption: 'Photo A' },
  { src: '/b.jpg', alt: 'Alt for photo B', caption: 'Photo B' },
  { src: '/c.jpg', alt: 'Alt for photo C', caption: 'Photo C' },
];

/** Minimal host: three trigger buttons plus the lightbox, like a real gallery. */
function Harness({ photos = PHOTOS }: { photos?: typeof PHOTOS }) {
  const { index, open, close, setIndex } = useLightbox();
  return (
    <div>
      {photos.map((p, i) => (
        <button key={p.src} type="button" onClick={(e) => open(i, e.currentTarget)}>
          {`Open ${p.caption}`}
        </button>
      ))}
      <PhotoLightbox
        photos={photos}
        index={index}
        onClose={close}
        onNavigate={setIndex}
        label="Test photos"
      />
    </div>
  );
}

const dialog = () => screen.getByRole('dialog');

describe('PhotoLightbox — opening', () => {
  it('is closed until a photo is activated', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on click and shows the photo with its real alt text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo B' }));

    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog()).getByAltText('Alt for photo B')).toBeInTheDocument();
    expect(within(dialog()).getByText('Photo B')).toBeInTheDocument();
  });

  it('opens from the keyboard with Enter and with Space', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole('button', { name: 'Open Photo A' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Open Photo A' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('moves focus into the dialog and locks page scrolling', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    expect(within(dialog()).getByRole('button', { name: 'Close photo viewer' }))
      .toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('PhotoLightbox — closing', () => {
  it('closes on the Close button and unlocks scrolling', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));
    await user.click(screen.getByRole('button', { name: 'Close photo viewer' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on a backdrop click but not on an image click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    // Clicking the photo itself must not dismiss the viewer.
    await user.click(within(dialog()).getByAltText('Alt for photo A'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const backdrop = dialog().parentElement!;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to the image that opened it', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open Photo C' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    // Focus restoration is deferred a frame so the overlay is gone first.
    await vi.advanceTimersByTimeAsync(50);
    expect(trigger).toHaveFocus();
    vi.useRealTimers();
  });
});

describe('PhotoLightbox — navigating a multi-photo gallery', () => {
  it('shows the position and steps forward and back', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog()).getByText('Photo 2 of 3')).toBeInTheDocument();
    expect(within(dialog()).getByAltText('Alt for photo B')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'Previous photo' }));
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('wraps around at both ends', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    await user.click(within(dialog()).getByRole('button', { name: 'Previous photo' }));
    expect(within(dialog()).getByText('Photo 3 of 3')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('navigates with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    await user.keyboard('{ArrowRight}');
    expect(within(dialog()).getByText('Photo 2 of 3')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(within(dialog()).getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('offers no Previous/Next for a single photo', async () => {
    const user = userEvent.setup();
    render(<Harness photos={[PHOTOS[0]]} />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    expect(within(dialog()).queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('button', { name: 'Previous photo' })).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(/Photo 1 of/)).not.toBeInTheDocument();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open Photo A' }));

    // Tab repeatedly; focus must never land on a trigger behind the overlay.
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog().contains(document.activeElement)).toBe(true);
    }
  });
});

describe('placeholders never open a lightbox', () => {
  it('renders no button inside a placeholder before/after tile', () => {
    render(<BeforeAfterTile placeholderLabel="Sofa job 1" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Recent results coming soon')).toBeInTheDocument();
  });

  it('renders no image trigger anywhere in a placeholder proof section', () => {
    render(
      <MemoryRouter>
        <ServiceProofSection
          heading="Recent results"
          subheading="Coming soon"
          galleryLabel="Sofa & Upholstery"
          galleryCategory="sofa-upholstery"
          secondary={{ type: 'video' }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /View larger/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('toLightboxPhotos', () => {
  it('expands before/after pairs into two captioned entries and skips video', () => {
    const items: GalleryItem[] = [
      {
        type: 'before-after',
        id: 'p1',
        label: 'Kitchen hob',
        before: '/b.jpg',
        after: '/a.jpg',
        beforeAlt: 'hob before',
        afterAlt: 'hob after',
      },
      { type: 'video', id: 'v1', label: 'Clip', src: '/v.mp4', poster: '/p.jpg' },
      { type: 'photo', id: 'ph1', label: 'Sink', src: '/s.jpg', alt: 'sink' },
    ];

    expect(toLightboxPhotos(items)).toEqual([
      { src: '/b.jpg', alt: 'hob before', caption: 'Kitchen hob — before' },
      { src: '/a.jpg', alt: 'hob after', caption: 'Kitchen hob — after' },
      { src: '/s.jpg', alt: 'sink', caption: 'Sink' },
    ]);
  });
});
