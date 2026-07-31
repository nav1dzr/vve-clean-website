import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RotatingResults from './RotatingResults';
import type { GalleryPhotoItem } from '../../data/galleryMedia';

const PHOTOS: GalleryPhotoItem[] = [
  { type: 'photo', id: '1', label: 'One',   src: '/a.jpg', alt: 'Photo one' },
  { type: 'photo', id: '2', label: 'Two',   src: '/b.jpg', alt: 'Photo two' },
  { type: 'photo', id: '3', label: 'Three', src: '/c.jpg', alt: 'Photo three' },
];

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RotatingResults', () => {
  it('renders photos in the exact order supplied — never shuffled', () => {
    mockMatchMedia(false);
    render(<RotatingResults photos={PHOTOS} label="Test" />);

    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();
    expect(screen.getByAltText('Photo one')).not.toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByAltText('Photo two')).toHaveAttribute('aria-hidden', 'true');
  });

  it('advances to the next photo on click and updates the status text', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<RotatingResults photos={PHOTOS} label="Test" />);

    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('supports keyboard arrow navigation on the carousel region', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<RotatingResults photos={PHOTOS} label="Test" />);

    const region = screen.getByRole('region', { name: /Test/i });
    await user.click(region);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();
  });

  it('supports direct navigation via dot controls', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<RotatingResults photos={PHOTOS} label="Test" />);

    await user.click(screen.getByRole('button', { name: 'Photo 3' }));
    expect(screen.getByText('Photo 3 of 3')).toBeInTheDocument();
  });

  it('shows a reduced-motion notice and does not autoplay when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    render(<RotatingResults photos={PHOTOS} label="Test" />);

    expect(screen.getByText(/Autoplay paused/i)).toBeInTheDocument();

    vi.advanceTimersByTime(10000);
    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();
  });

  it('stops autoplay once the visitor manually navigates', async () => {
    mockMatchMedia(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<RotatingResults photos={PHOTOS} label="Test" />);

    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();

    vi.advanceTimersByTime(10000);
    // Autoplay is disabled after manual interaction — position stays put.
    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();
  });
});
