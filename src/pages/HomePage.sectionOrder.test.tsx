import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const homepage = readFileSync(resolve(here, 'HomePage.tsx'), 'utf8');
const guarantee = readFileSync(resolve(here, '../components/Guarantee.tsx'), 'utf8');

/** Index of a component's JSX usage in the rendered main element. */
function positionOf(component: string): number {
  const main = homepage.slice(homepage.indexOf('<main'), homepage.indexOf('</main>'));
  const index = main.indexOf(`<${component}`);
  expect(index, `<${component}> is not rendered on the homepage`).toBeGreaterThan(-1);
  return index;
}

const before = (a: string, b: string) => positionOf(a) < positionOf(b);

// §9: promise → services → team/trust → reviews/results → price entry →
// coverage → short FAQ. Kept as a test because section order is the kind of
// thing that drifts silently when a section is added.
describe('homepage section order', () => {
  it('opens with the promise', () => {
    expect(before('Hero', 'Services')).toBe(true);
  });

  it('shows the services before asking for trust', () => {
    expect(before('Services', 'TrustBadges')).toBe(true);
  });

  it('establishes trust before showing proof', () => {
    expect(before('TrustBadges', 'Reviews')).toBe(true);
    expect(before('OurKit', 'Reviews')).toBe(true);
  });

  it('shows proof before the price entry', () => {
    expect(before('Reviews', 'QuoteCalculator')).toBe(true);
    expect(before('Gallery', 'QuoteCalculator')).toBe(true);
  });

  it('puts coverage after the price entry', () => {
    expect(before('QuoteCalculator', 'Areas')).toBe(true);
  });

  it('ends with the FAQ and a direct contact route', () => {
    expect(before('Areas', 'FAQ')).toBe(true);
    expect(before('FAQ', 'Contact')).toBe(true);
  });

  it('renders only one homepage service-card section', () => {
    expect(homepage).toContain('<Services onChoose={chooseService} />');
    expect(homepage).not.toContain('<HomeServiceSelector');
  });

  it('answers the price objection immediately after the price', () => {
    expect(before('QuoteCalculator', 'Guarantee')).toBe(true);
  });
});

describe('the quote journey is preserved', () => {
  it('still renders the calculator the #quote anchor and CTAs scroll to', () => {
    expect(homepage).toContain('<QuoteCalculator');
    expect(homepage).toContain('homepageMode');
  });

  it('still remounts the calculator when the service changes', () => {
    expect(homepage).toMatch(/key=\{selectedQuoteService/);
  });
});

describe('detailed guarantee exclusions moved off the homepage', () => {
  it('no longer lists the full exclusion set on the homepage section', () => {
    // These were seven bullets in a "Not covered" column.
    expect(guarantee).not.toContain('Odours from hidden sources');
    expect(guarantee).not.toContain('Old paint marks or structural discolouration');
    expect(guarantee).not.toContain('NOT_COVERED');
  });

  it('keeps the promise and the qualifying conditions', () => {
    expect(guarantee).toContain('GUARANTEE_COVERED');
    expect(guarantee).toContain('What qualifies');
  });

  it('links to the full terms on the page the guarantee belongs to', () => {
    expect(guarantee).toContain('/end-of-tenancy-cleaning-london#guarantee');
    expect(guarantee).toMatch(/See the full guarantee terms/);
  });

  it('still warns that exclusions exist rather than implying blanket cover', () => {
    expect(guarantee).toMatch(/not covered/i);
    expect(guarantee).toMatch(/wear and tear/i);
  });
});
