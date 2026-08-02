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

  it('keeps a route through to the Gallery and Instagram', () => {
    renderSection();

    expect(screen.getByRole('link', { name: 'View full Gallery' }))
      .toHaveAttribute('href', '/gallery?category=sofa-upholstery');
    expect(screen.getByRole('link', { name: /Instagram/i })).toBeInTheDocument();
  });
});
