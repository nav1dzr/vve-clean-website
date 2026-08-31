import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Claims a customer could rely on must be traceable to something in this
// repository — the pricing catalogue, a published policy, or an owner
// confirmation recorded in docs/. These four were not:
//
//   "10% to 30% off" for regular cleaning   no such discount exists anywhere
//   "back to their original colour"          an outcome claim, surface-dependent
//   "green-waste removal"                    a licensed waste-carrier activity
//   "out-of-hours visits, monthly invoicing" asserted as standing commitments
//                                            while the same pages' FAQs said
//                                            they are agreed per site
//
// Each is now written-scope or enquiry language. Nothing was invented to
// replace them, and no service was removed — only the unconfirmed promise
// around it.

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');
const readRaw = (p: string) => readFileSync(resolve(srcRoot, p), 'utf8');

/**
 * File contents with comments removed.
 *
 * The comments recording *why* each claim was changed necessarily quote the
 * old wording, so scanning raw source would flag every fix as a violation.
 * These checks are about what reaches the customer, which is the code.
 */
const read = (p: string) =>
  readRaw(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(resolve(srcRoot, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(rel);
  }
  return out;
}

const allSource = sourceFiles('.');

describe('no unsupported percentage discount is advertised', () => {
  // The EOT carpet package's "up to 50%" is different: it is computed from
  // EOT_CARPET_PACKAGE_DISCOUNT_PCT and its conditions are stated in the FAQ.
  // What is banned is a percentage with no catalogue constant behind it.
  it('does not promise a 10%–30% regular-cleaning discount', () => {
    for (const file of allSource) {
      const source = read(file);
      expect(source, `${file} advertises an unsupported discount range`).not.toMatch(
        /10%\s*(?:to|–|-|—)\s*30%/,
      );
    }
  });

  it('invites an enquiry about regular schedules instead', () => {
    const calc = read('components/QuoteCalculator.tsx');
    expect(calc).toMatch(/Cleaning on a regular schedule\?/);
    expect(calc).toMatch(/quote for the schedule rather than a single visit/);
    expect(calc).toMatch(/confirm the price in writing/);
  });
});

describe('service descriptions make no unverifiable outcome claim', () => {
  it('does not promise pressure washing restores original colour', () => {
    for (const file of allSource) expect(read(file)).not.toMatch(/original colou?r/i);
  });

  it('does not promise green-waste removal', () => {
    for (const file of allSource) expect(read(file)).not.toMatch(/green[-\s]waste/i);
  });

  it('keeps both secondary services visible on the full pricing page without an outcome promise', () => {
    const pricing = read('pages/PricingPage.tsx');
    expect(pricing).toContain('Pressure Washing');
    expect(pricing).toContain('Garden Services');
  });
});

describe('commercial terms are written-scope, not standing commitments', () => {
  it('the homepage card promises a written scope rather than contract terms', () => {
    const services = read('components/Services.tsx');
    const commercialCard = services.slice(
      services.indexOf("title: 'Commercial & communal'"),
      services.indexOf("title: 'Window cleaning'"),
    );

    expect(commercialCard).toMatch(/quote against a written scope/i);
    expect(commercialCard).not.toMatch(/out-of-hours visits, monthly invoicing/i);
  });

  it.each([
    ['pages/CommercialPage.tsx', /Access hours agreed per site/],
    ['pages/CommercialPage.tsx', /Invoicing agreed per contract/],
    ['pages/CommercialCarpetPage.tsx', /Out-of-hours visits can be arranged/],
  ])('%s qualifies its access and billing language', (file, expected) => {
    expect(read(file)).toMatch(expected);
  });

  it('no page asserts out-of-hours or monthly invoicing as a standing fact', () => {
    for (const file of allSource) {
      const source = read(file);
      expect(source, `${file} asserts out-of-hours as standing`).not.toMatch(
        /Out-of-hours (?:visits )?available/i,
      );
      expect(source, `${file} asserts monthly invoicing as standing`).not.toMatch(
        /(?:^|[^a-z])Monthly invoicing(?:'|"|<|,|\s*\])/i,
      );
      expect(source, `${file} promises one simple monthly invoice`).not.toMatch(
        /one simple monthly invoice/i,
      );
    }
  });
});

describe('the services themselves remain reachable after homepage simplification', () => {
  it('keeps Commercial & communal among the five homepage choices', () => {
    expect(read('components/Services.tsx')).toContain('Commercial & communal');
  });

  it.each(['Window Cleaning', 'Pressure Washing', 'Garden Services'])(
    '%s remains on the complete price list',
    (title) => expect(read('pages/PricingPage.tsx')).toContain(title),
  );
});
