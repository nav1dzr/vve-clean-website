// Guards the carpet results section against publishing unfinished media.
//
// The carpet page previously showed a "library coming soon" placeholder. It now
// shows real before/after pairs — and must never regress into showing an empty
// slot, a broken video player, or media borrowed from another service.

import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CarpetResultsSection from './CarpetResultsSection';
import { CARPET_FEATURED_BEFORE_AFTER, GALLERY_MEDIA } from '../../data/galleryMedia';
import { CARPET_RESULT_VIDEOS, CARPET_PROCESS_VIDEO } from '../../data/carpetMedia';

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {} unobserve() {} disconnect() {}
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
});

const renderSection = () =>
  render(<MemoryRouter><CarpetResultsSection /></MemoryRouter>);

describe('carpet media manifest', () => {
  it('publishes only genuinely matched carpet pairs', () => {
    expect(CARPET_FEATURED_BEFORE_AFTER.length).toBeGreaterThan(0);
    for (const pair of CARPET_FEATURED_BEFORE_AFTER) {
      expect(pair.before).toBeTruthy();
      expect(pair.after).toBeTruthy();
      expect(pair.beforeAlt.length).toBeGreaterThan(20);
      expect(pair.afterAlt.length).toBeGreaterThan(20);
    }
  });

  it('never borrows media from another service', () => {
    const all = CARPET_FEATURED_BEFORE_AFTER.flatMap((p) => [p.before, p.after]);
    for (const src of all) {
      expect(src).not.toMatch(/end_of_tenancy|sofa|upholstery|window|driveway/i);
      expect(src).toMatch(/carpet/i);
    }
  });

  it('references no undecodable HEIC or unplayable QuickTime source', () => {
    const all = [
      ...CARPET_FEATURED_BEFORE_AFTER.flatMap((p) => [p.before, p.after]),
      ...CARPET_RESULT_VIDEOS.flatMap((v) => [v.src, v.webm, v.poster]),
      ...(CARPET_PROCESS_VIDEO ? [CARPET_PROCESS_VIDEO.src, CARPET_PROCESS_VIDEO.poster] : []),
    ].filter(Boolean) as string[];
    for (const src of all) {
      expect(src).not.toMatch(/\.heic$/i);
      expect(src).not.toMatch(/\.mov$/i);
    }
  });

  it('requires a poster on every published video', () => {
    for (const v of [...CARPET_RESULT_VIDEOS, ...(CARPET_PROCESS_VIDEO ? [CARPET_PROCESS_VIDEO] : [])]) {
      expect(v.poster).toBeTruthy();
      expect(v.src).toMatch(/\.mp4$/i);
    }
  });

  it('feeds the same pairs into the Gallery page carpet category', () => {
    expect(GALLERY_MEDIA.carpet.length).toBe(CARPET_FEATURED_BEFORE_AFTER.length);
  });
});

describe('CarpetResultsSection', () => {
  it('renders the real results heading, not a coming-soon placeholder', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: /Recent carpet results/i })).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/check back soon/i)).not.toBeInTheDocument();
  });

  it('shows every published pair with Before and After labelled', () => {
    renderSection();
    expect(screen.getAllByText(/^Before$/i).length).toBe(CARPET_FEATURED_BEFORE_AFTER.length);
    expect(screen.getAllByText(/^After$/i).length).toBe(CARPET_FEATURED_BEFORE_AFTER.length);
  });

  it('gives every image descriptive alt text', () => {
    renderSection();
    for (const img of screen.getAllByRole('img')) {
      expect(img.getAttribute('alt')?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('offers both the Gallery link and the Instagram link', () => {
    renderSection();
    expect(screen.getByRole('link', { name: /View full Gallery/i }))
      .toHaveAttribute('href', '/gallery?category=carpet');
    expect(screen.getByRole('link', { name: /Instagram/i })).toBeInTheDocument();
  });

  it('renders no video element while the manifest is empty', () => {
    const { container } = renderSection();
    expect(container.querySelectorAll('video').length).toBe(CARPET_RESULT_VIDEOS.length);
  });
});
