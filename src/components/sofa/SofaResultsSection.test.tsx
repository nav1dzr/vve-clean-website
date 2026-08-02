// The Sofa proof section holds reserved slots, not results.
//
// The risk this guards against is a customer being shown a carpet or
// end-of-tenancy photograph as though it were a sofa job. These tests assert
// the section says plainly what it is, shows the right number of slots, and
// renders no photograph at all while the approved set is outstanding.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SofaResultsSection from './SofaResultsSection';
import { GALLERY_MEDIA } from '../../data/galleryMedia';

function renderSection() {
  return render(
    <MemoryRouter>
      <SofaResultsSection />
    </MemoryRouter>,
  );
}

describe('SofaResultsSection', () => {
  it('is still awaiting an approved sofa set', () => {
    // If this ever fails, the section has switched to real photos and the
    // expectations below should be revisited rather than deleted.
    expect(GALLERY_MEDIA['sofa-upholstery']).toHaveLength(0);
  });

  it('reserves three before/after, three video and one rotating slot', () => {
    renderSection();

    expect(screen.getAllByRole('img', { name: /Before and after —/ })).toHaveLength(3);
    expect(screen.getAllByRole('img', { name: /Short clip —/ })).toHaveLength(3);
    expect(screen.getAllByRole('img', { name: /Rotating results —/ })).toHaveLength(1);
  });

  it('says clearly that genuine sofa results are being prepared', () => {
    renderSection();

    expect(screen.getAllByText(/Genuine sofa results are being prepared/).length)
      .toBeGreaterThanOrEqual(7);
    expect(screen.getByRole('heading', { name: /Sofa results, photographed properly/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/only publish photographs and video of upholstery we have actually cleaned/i))
      .toBeInTheDocument();
  });

  it('shows no photograph or video at all — nothing borrowed from another service', () => {
    const { container } = renderSection();

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('video')).toHaveLength(0);
    // Nothing pointing at the carpet or end-of-tenancy media folders.
    expect(container.innerHTML).not.toMatch(/\/carpet\//);
    expect(container.innerHTML).not.toMatch(/\/end_of_tenancy\//);
  });

  it('makes none of the reserved slots clickable', () => {
    renderSection();

    // The only interactive elements are the CTA links underneath.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View larger/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Regression: the three video slots resolved to 396px inside a 375px
  // viewport and pushed the page 37px sideways (22px at 390px).
  //
  // Cause: a grid item's automatic minimum size is its min-content width, so
  // the column could not shrink below the caption's longest run; aspect-video
  // then derived the width from the height, because the width was auto.
  //
  // jsdom performs no layout, so this cannot be asserted in pixels here — the
  // real measurement is the browser pass in the handover notes. What is pinned
  // instead is the constraint that prevents it: every slot is width-bound to
  // its column and allowed to shrink, and its grid lets the track shrink too.
  describe('no horizontal overflow on a narrow phone', () => {
    it('binds every reserved slot to its column width and lets it shrink', () => {
      renderSection();

      const slots = screen.getAllByRole('img', { name: /Genuine sofa results/ });
      expect(slots).toHaveLength(7);

      for (const slot of slots) {
        const cls = slot.className;
        // Width comes from the column, never from the intrinsic content.
        expect(cls).toContain('w-full');
        // Defeats the grid item's automatic min-content minimum.
        expect(cls).toContain('min-w-0');
        // No fixed width could survive a 375px column.
        expect(cls).not.toMatch(/\bw-\[\d/);
        expect(cls).not.toMatch(/\bmin-w-\[\d/);
        expect(slot.getAttribute('style') ?? '').not.toMatch(/width/);
      }
    });

    it('lets the grid tracks themselves shrink below min-content', () => {
      const { container } = renderSection();

      const grids = [...container.querySelectorAll('div')]
        .filter((d) => d.className.includes('grid-cols-3'));
      expect(grids).toHaveLength(2);
      grids.forEach((g) => expect(g.className).toContain('[&>*]:min-w-0'));
    });

    it('sets no fixed pixel width anywhere in the section', () => {
      const { container } = renderSection();

      const fixed = [...container.querySelectorAll('*')].filter((el) => {
        const style = el.getAttribute('style') ?? '';
        return /(^|[^-])width:\s*\d+px/.test(style);
      });
      expect(fixed).toEqual([]);
    });
  });

  // Wired to the shared lightbox ahead of the photos themselves. While the
  // slots are reserved there is nothing to enlarge, so nothing is clickable —
  // the "once photos arrive" half lives in SofaResultsSection.lightbox.test.
  it('opens no lightbox while the slots are reserved', () => {
    renderSection();
    expect(screen.queryByRole('button', { name: /^View larger:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps a route through to the Gallery and Instagram', () => {
    renderSection();

    expect(screen.getByRole('link', { name: 'View full Gallery' }))
      .toHaveAttribute('href', '/gallery?category=sofa-upholstery');
    expect(screen.getByRole('link', { name: /Instagram/i })).toBeInTheDocument();
  });
});
