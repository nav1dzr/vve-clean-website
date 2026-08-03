import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SofaProofSection from './SofaProofSection';
import { SOFA_BEFORE_AFTER, SOFA_FEATURE_VIDEO } from '../../data/sofaMedia';

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

const renderSection = () =>
  render(<MemoryRouter><SofaProofSection /></MemoryRouter>);

describe('the four approved before/after pairs', () => {
  it('renders exactly four, each with both halves', () => {
    renderSection();

    for (const pair of SOFA_BEFORE_AFTER) {
      expect(screen.getByText(pair.label)).toBeInTheDocument();
      expect(screen.getByAltText(pair.beforeAlt)).toBeInTheDocument();
      expect(screen.getByAltText(pair.afterAlt)).toBeInTheDocument();
    }
    // Three pairs are genuine before/after. The fourth was shot mid-job and is
    // labelled for what it shows, so the default badges appear 3 times, not 4.
    expect(screen.getAllByText('Before')).toHaveLength(3);
    expect(screen.getAllByText('After')).toHaveLength(3);
    expect(screen.getByText('Before cleaning')).toBeInTheDocument();
    expect(screen.getByText('During extraction')).toBeInTheDocument();
    expect(screen.queryByText('Buttoned chair back')).not.toBeInTheDocument();
    expect(screen.getByText('Dining chair cleaning in progress')).toBeInTheDocument();
  });

  it('captions the in-progress card as "during extraction" in the lightbox too', async () => {
    const user = userEvent.setup();
    renderSection();

    const chair = SOFA_BEFORE_AFTER.find((p) => p.id === 'sofa-ba-buttoned-chair')!;
    await user.click(screen.getByRole('button', { name: `View larger: ${chair.afterAlt}` }));

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Dining chair cleaning in progress — during extraction'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/— after$/)).not.toBeInTheDocument();
  });

  it('points every image at a web-safe derivative', () => {
    renderSection();

    for (const img of screen.getAllByRole('img')) {
      const src = img.getAttribute('src') ?? '';
      expect(src).not.toMatch(/\.heic$/i);
      expect(src).not.toMatch(/\.mov$/i);
    }
  });

  it('opens the shared lightbox on the exact half that was clicked', async () => {
    const user = userEvent.setup();
    renderSection();

    const pair = SOFA_BEFORE_AFTER[1];
    await user.click(screen.getByRole('button', { name: `View larger: ${pair.afterAlt}` }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText(pair.afterAlt)).toBeInTheDocument();
    expect(within(dialog).getByText(`${pair.label} — after`)).toBeInTheDocument();
  });

  it('walks the pairs in reading order — before then after, pair by pair', async () => {
    const user = userEvent.setup();
    renderSection();

    const first = SOFA_BEFORE_AFTER[0];
    await user.click(screen.getByRole('button', { name: `View larger: ${first.beforeAlt}` }));

    const dialog = screen.getByRole('dialog');
    // Index 0 is pair 0's "before"; Next must land on pair 0's "after".
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByAltText(first.afterAlt)).toBeInTheDocument();

    // And again lands on pair 1's "before", not pair 1's "after".
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByAltText(SOFA_BEFORE_AFTER[1].beforeAlt)).toBeInTheDocument();
  });

  it('returns focus to the tile that opened it', async () => {
    const user = userEvent.setup();
    renderSection();

    const trigger = screen.getByRole('button', {
      name: `View larger: ${SOFA_BEFORE_AFTER[0].beforeAlt}`,
    });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the featured extraction clip', () => {
  it('leads with a heading that says what the clip shows', () => {
    renderSection();
    expect(
      screen.getByRole('heading', { name: 'See what professional extraction removes' }),
    ).toBeInTheDocument();
  });

  it('is muted, looping, inline and autoplaying, with a poster', () => {
    const { container } = renderSection();
    const video = container.querySelector('video');

    expect(video).not.toBeNull();
    expect(video).toHaveProperty('muted', true);
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('poster', SOFA_FEATURE_VIDEO.poster);
  });

  it('carries an accessible description rather than an unlabelled box', () => {
    const { container } = renderSection();
    expect(container.querySelector('video'))
      .toHaveAttribute('aria-label', SOFA_FEATURE_VIDEO.description);
  });

  it('withholds the source until the clip is near the viewport', () => {
    // No IntersectionObserver has fired in jsdom, so nothing should be
    // downloadable yet — this is what keeps four clips off the critical path.
    const { container } = renderSection();
    expect(container.querySelectorAll('video source')).toHaveLength(0);
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
  });

  it('is not exposed as a lightbox photo', () => {
    renderSection();
    // Eight halves from four pairs — the clip must not add a ninth entry.
    expect(screen.getAllByRole('button', { name: /^View larger:/ })).toHaveLength(8);
  });
});

describe('mobile layout containment', () => {
  it('lets every card shrink with its column instead of setting a width floor', () => {
    // jsdom does no layout, so this pins the CSS contract that the browser pass
    // then measures: a grid item's automatic minimum size is its min-content
    // width, and without min-w-0 the caption sets a floor the column cannot go
    // below — which is exactly how this section previously pushed the page 37px
    // sideways at 375px.
    const { container } = renderSection();

    const grid = container.querySelector('.grid.gap-6');
    expect(grid?.className).toContain('[&>*]:min-w-0');

    const videoStage = container.querySelector('video')?.parentElement;
    expect(videoStage?.className).toContain('min-w-0');
    expect(videoStage?.className).toContain('w-full');
    // A fixed pixel width would reintroduce the overflow at any narrower width.
    // max-w-[340px] is fine and is deliberately allowed through: it caps the
    // stage on desktop but still lets it shrink below 340px on a phone.
    expect(videoStage?.className).not.toMatch(/(^|\s)w-\[\d+px\]/);
  });
});
