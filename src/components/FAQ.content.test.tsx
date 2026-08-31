import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAQS } from './FAQ';
import {
  EOT_CARPET_PACKAGE_DISCOUNT_PCT,
  EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS,
  EOT_CARPET_QUALIFYING_KEYS,
  EOT_GUARANTEE_HOURS,
} from '../data/pricing';

const answerFor = (fragment: string | RegExp) => {
  const match = FAQS.find(({ q }) =>
    typeof fragment === 'string' ? q.includes(fragment) : fragment.test(q),
  );
  if (!match) throw new Error(`No FAQ matching ${fragment}`);
  return match.a;
};

describe('FAQ covers the topics a customer actually asks about', () => {
  it.each([
    ['unavailable requested date', /not available/i],
    ['adding carpet to an EOT booking', /add carpet cleaning/i],
    ['the carpet discount conditions', /% off carpet cleaning/i],
    ['an agent flagging an issue', /agent or landlord flags/i],
    ['occupied vs vacant properties', /occupied homes/i],
    ['when payment is taken', /When do I pay/i],
    ['whether the price can change', /price change/i],
    ['cancelling or rescheduling', /reschedule or cancel/i],
    ['coverage', /areas do you cover/i],
    ['equipment and products', /equipment and products/i],
    ['availability', /How quickly can you come/i],
    ['the re-clean guarantee', /re-clean guarantee/i],
  ])('answers %s', (_topic, pattern) => {
    expect(FAQS.some(({ q }) => pattern.test(q))).toBe(true);
  });

  it('asks every question once', () => {
    const questions = FAQS.map(({ q }) => q);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('gives every question a substantial answer', () => {
    for (const { q, a } of FAQS) {
      expect(a.length, `"${q}" has a thin answer`).toBeGreaterThan(80);
    }
  });
});

describe('the carpet discount is stated with its qualifying conditions', () => {
  const answer = () => answerFor(/% off carpet cleaning/i);

  it('names the minimum number of qualifying areas', () => {
    expect(answer()).toContain(String(EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS));
  });

  it('lists what actually qualifies, drawn from the canonical key list', () => {
    const text = answer().toLowerCase();
    // Every qualifying key should be recognisable in the prose. 'large_lounge'
    // reads as "large lounges", so compare on the first word of each key.
    for (const key of EOT_CARPET_QUALIFYING_KEYS) {
      expect(text, `"${key}" is not described`).toContain(key.split('_')[0]);
    }
  });

  it('explains why the claim says "up to" rather than a flat rate', () => {
    expect(answer()).toMatch(/£85/);
    expect(answer()).toMatch(/up to/i);
  });

  it('names the exclusions rather than implying everything qualifies', () => {
    const text = answer().toLowerCase();
    expect(text).toContain('rugs');
    expect(text).toMatch(/wool|silk|delicate/);
    expect(text).toMatch(/photo review|quoted separately/);
  });

  it('never promises a bare 50% off with no conditions attached', () => {
    for (const { a } of FAQS) {
      if (new RegExp(`${EOT_CARPET_PACKAGE_DISCOUNT_PCT}%`).test(a)) {
        expect(a).toMatch(/up to|at least|qualifying/i);
      }
    }
  });
});

describe('the guarantee and refund answers match the real process', () => {
  it('states the guarantee window from the canonical constant', () => {
    expect(answerFor(/agent or landlord flags/i)).toContain(String(EOT_GUARANTEE_HOURS));
  });

  it('keeps the guarantee exclusions visible', () => {
    const answer = answerFor(/agent or landlord flags/i);
    expect(answer).toMatch(/does not guarantee that a tenancy deposit will be returned/i);
    expect(answer).toMatch(/damage, repairs or issues outside the booked scope/i);
  });

  // The webhook discards charge.refunded, so refunds are initiated by hand.
  it('does not claim the unavailable-slot refund is automatic', () => {
    expect(answerFor(/not available/i)).not.toMatch(/automatically|automatic/i);
  });

  it('makes clear that an unavailable request creates no charge to refund', () => {
    const answer = answerFor(/not available/i);

    expect(answer).toMatch(/nothing is charged/i);
    expect(answer).toMatch(/only after you accept an available time/i);
    expect(answer).not.toMatch(/refund/i);
  });

  // Refund timing remains relevant only after a customer has accepted a time
  // and paid. The Terms must describe that separate, later-stage process
  // without promising an issuer-controlled settlement date.
  it('keeps issuer-controlled refund timing in the Terms', () => {
    const terms = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../pages/TermsOfServicePage.tsx'),
      'utf8',
    );

    expect(terms).toMatch(/5 to 10 business days/);
    expect(terms).toMatch(/card issuer/i);
    expect(terms).not.toMatch(/\b14 business days\b/);
  });
});
