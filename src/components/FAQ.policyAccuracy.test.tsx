// Two FAQ answers previously promised more than the business had agreed.
//
// 1. "Can I reschedule or cancel?" said cancelling AND rescheduling were free
//    until noon the day before. Terms §5 makes only *rescheduling* free at that
//    deadline; a cancellation inside 24 hours may forfeit the deposit. The FAQ
//    was offering customers a refund right the Terms do not give them.
//
// 2. "Do I need to be home?" asserted that most customers leave keys with us,
//    that completion photos are always sent, and that keys are returned however
//    the customer likes. None is a documented operational commitment.
//
// These specs read the real FAQ and the real Terms so the wording cannot drift
// back, and so a future change to the underlying policy has to change both.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FAQS } from './FAQ';

const here = dirname(fileURLToPath(import.meta.url));
const terms = readFileSync(resolve(here, '../pages/TermsOfServicePage.tsx'), 'utf8');

const answerFor = (pattern: RegExp) => {
  const match = FAQS.find(({ q }) => pattern.test(q));
  if (!match) throw new Error(`No FAQ matching ${pattern}`);
  return match.a;
};

describe('the cancellation answer matches the Terms', () => {
  const answer = () => answerFor(/reschedule or cancel/i);

  it('offers the free deadline for rescheduling only', () => {
    expect(answer()).toMatch(/Rescheduling is free if you contact us before 12 noon/i);
  });

  it('never says cancellation is free at that deadline', () => {
    const text = answer();
    // The old wording: "cancel or reschedule without charge until 12pm".
    expect(text).not.toMatch(/cancel or reschedule without charge/i);
    expect(text).not.toMatch(/cancel[^.]*free/i);
    expect(text).not.toMatch(/free[^.]*cancel/i);
  });

  it('states the deposit consequence of a late cancellation', () => {
    const text = answer();
    expect(text).toMatch(/less than 24 hours/i);
    expect(text).toMatch(/deposit being retained/i);
  });

  it('points the customer at the full cancellation terms', () => {
    expect(answer()).toMatch(/cancellation terms/i);
  });

  it('agrees with Terms §5 on both the deadline and the 24-hour rule', () => {
    const answerText = answer();

    // Same deadline, written the same way round: noon, the day before.
    expect(terms).toMatch(/12:00 noon the day before/i);
    expect(answerText).toMatch(/12 noon on the day before/i);

    // Same forfeiture trigger.
    expect(terms).toMatch(/less than 24 hours notice/i);
    expect(answerText).toMatch(/less than 24 hours/i);

    // The Terms say "forfeited", the FAQ says "retained" — same meaning in
    // plainer words. Neither may claim the deposit is safe.
    expect(terms).toMatch(/deposit being forfeited/i);
    expect(answerText).not.toMatch(/deposit is refunded|full refund/i);
  });

  it('keeps the free-reschedule deadline anchored to the Terms section that owns it', () => {
    // Section 5 is the cancellation section; if it is renamed or renumbered the
    // FAQ's "see the cancellation terms" pointer needs revisiting.
    expect(terms).toContain("id: 'cancellations'");
    expect(terms).toMatch(/5\. Cancellations and Rescheduling/);
  });
});

describe('the access answer claims no unagreed operational commitment', () => {
  const answer = () => answerFor(/need to be home/i);

  it('says attendance is not normally required, conditioned on agreed access', () => {
    const text = answer();
    expect(text).toMatch(/do not normally need to remain at the property/i);
    expect(text).toMatch(/access and key arrangements are agreed before the appointment/i);
  });

  it('asks the customer to confirm key return and photos per booking', () => {
    expect(answer()).toMatch(/Confirm the key-return and completion-photo arrangements/i);
  });

  it('drops the claim that most customers leave keys with us', () => {
    const text = answer();
    expect(text).not.toMatch(/most (end of tenancy )?customers/i);
    expect(text).not.toMatch(/leave keys with us/i);
  });

  it('never promises photos are always sent', () => {
    const text = answer();
    expect(text).not.toMatch(/we send photos/i);
    expect(text).not.toMatch(/photos when the job is done/i);
  });

  it('never promises keys are returned however the customer wants', () => {
    expect(answer()).not.toMatch(/return keys however suits you/i);
  });
});

describe('no FAQ answer reintroduces the withdrawn claims', () => {
  it.each([
    ['unconditional free cancellation', /cancel[^.]{0,40}without charge/i],
    ['guaranteed completion photos', /we (always )?send (you )?photos/i],
    ['keys returned however you like', /keys however/i],
  ])('%s appears nowhere in the FAQ', (_label, pattern) => {
    const offenders = FAQS.filter(({ a }) => pattern.test(a)).map(({ q }) => q);
    expect(offenders).toEqual([]);
  });
});
