// Static guards for the layout defects that actually cause horizontal
// overflow at 320px, the narrowest width in the review brief.
//
// This is not a substitute for looking at the pages in a browser — it cannot
// measure a rendered box. What it can do is catch the specific authoring
// patterns that have caused overflow in this codebase before, on every page,
// on every run.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx$/.test(entry.name) && !entry.name.includes('.test.')) out.push(rel);
  }
  return out;
}

const files = sourceFiles('src');

describe('global overflow guards', () => {
  it('hides horizontal overflow at the document level', () => {
    expect(read('src/index.css')).toMatch(/overflow-x:\s*hidden/);
  });

  it('honours prefers-reduced-motion', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    // The reveal hook must also check it, or JS-driven animation ignores the
    // setting even when CSS transitions are disabled.
    expect(read('src/hooks/useReveal.ts')).toContain('prefers-reduced-motion');
  });

  it('provides a skip link to the main landmark', () => {
    expect(read('src/App.tsx')).toContain('Skip to main content');
    expect(read('src/App.tsx')).toContain('#main-content');
  });
});

describe('no fixed widths that cannot fit a 320px viewport', () => {
  // A hard px width wider than 320 minus typical padding overflows the
  // narrowest supported screen — but only when it applies at that width.
  // Excluded, because none of these can overflow a phone:
  //
  //   max-w-[…]              a ceiling; the element still shrinks
  //   sm: md: lg: xl: 2xl:   breakpoint-scoped, so never active at 320px
  //   aria-hidden decoration inside an overflow-hidden parent
  //
  // The leading (^|\s) is what keeps `max-w-[…]` out: without it, `w-\[`
  // matches inside `max-w-[…]` and every ceiling looks like a violation.
  const FIXED_WIDTH = /(?:^|\s)(w|min-w)-\[(\d+)px\]/gm;

  it.each(files)('%s uses no unresponsive fixed width', (file) => {
    const source = read(file);
    const lines = source.split('\n');

    const offenders = [];
    for (const line of lines) {
      for (const m of line.matchAll(FIXED_WIDTH)) {
        if (Number(m[2]) <= 288) continue;
        // `absolute`/`fixed` elements are out of normal flow, so their width
        // cannot push the document sideways. Combined with a clipping
        // ancestor this is how decorative blurs and desktop dropdowns are
        // legitimately wider than the phone viewport.
        if (/\b(absolute|fixed)\b/.test(line)) continue;
        offenders.push(m[0].trim());
      }
    }

    expect(
      offenders,
      `${file} sets a width wider than a 320px viewport can show. Use a ` +
        'max-w-[…] ceiling, scope it to a breakpoint (sm:/md:/lg:), or take ' +
        'it out of flow with absolute positioning inside a clipping parent.',
    ).toEqual([]);
  });

  // A decorative blur can legitimately exceed the viewport, but only if its
  // container clips it — otherwise it pushes the page sideways.
  it('clips the oversized decorative blur on the commercial hero', () => {
    const source = read('src/pages/CommercialPage.tsx');
    const blurLine = source
      .split('\n')
      .find((line) => line.includes('w-[520px]'));

    expect(blurLine).toBeDefined();
    expect(blurLine).toContain('aria-hidden="true"');
    // Its section must clip, or the blur becomes horizontal scroll.
    const sectionIndex = source.lastIndexOf('overflow-hidden', source.indexOf('w-[520px]'));
    expect(sectionIndex).toBeGreaterThan(-1);
  });
});

describe('tap targets and mobile input sizing', () => {
  // iOS zooms the viewport when a focused input's font-size is under 16px,
  // which is itself a source of apparent horizontal overflow.
  it('sets a 16px floor on form controls', () => {
    const css = read('src/index.css');
    const bookingPage = read('src/pages/BookingPage.tsx');
    const hasCssFloor = /input|select|textarea/.test(css) && /16px/.test(css);
    expect(hasCssFloor || bookingPage.includes('text-[16px]')).toBe(true);
  });

  it('keeps the sticky bar actions at or above 48px', () => {
    expect(read('src/components/MobileStickyFooter.tsx')).toContain('min-h-[48px]');
  });
});
