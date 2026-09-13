// FAQ and Terms must present the owner-confirmed notice consistently.
//
// 1. "Can I reschedule or cancel?" said cancelling AND rescheduling were free
//    until noon the day before. The confirmed notice is now 24 hours.
//    Only rescheduling is described as free. Any cancellation or call-out
//    charge must instead have been agreed when the appointment was confirmed.
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
import { beforeEach, describe, expect, it } from 'vitest';
import { FAQS } from './FAQ';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import TermsOfServicePage from '../pages/TermsOfServicePage';

const here = dirname(fileURLToPath(import.meta.url));
const termsSource = readFileSync(resolve(here, '../pages/TermsOfServicePage.tsx'), 'utf8');
let terms = '';
beforeEach(() => {
  const { container } = render(<MemoryRouter><CookieConsentProvider><TermsOfServicePage /></CookieConsentProvider></MemoryRouter>);
  terms = (container.textContent ?? '').replace(/\s+/g, ' ');
});

const answerFor = (pattern: RegExp) => {
  const match = FAQS.find(({ q }) => pattern.test(q));
  if (!match) throw new Error(`No FAQ matching ${pattern}`);
  return match.a;
};

describe('the cancellation answer matches the Terms', () => {
  const answer = () => answerFor(/reschedule or cancel/i);

  it('offers the free deadline for rescheduling only', () => {
    expect(answer()).toMatch(/Rescheduling is free with at least 24 hours/i);
  });

  it('never says cancellation is free at that deadline', () => {
    const text = answer();
    // The old wording: "cancel or reschedule without charge until 12pm".
    expect(text).not.toMatch(/cancel or reschedule without charge/i);
    expect(text).not.toMatch(/cancel[^.]*free/i);
    expect(text).not.toMatch(/free[^.]*cancel/i);
  });

  it('states how late cancellations are handled without inventing a fee', () => {
    const text = answer();
    expect(text).toMatch(/For shorter notice, contact us as soon as possible/i);
    expect(text).toMatch(/charge applies only if it was stated and agreed in writing/i);
  });

  it('points the customer at the full cancellation terms', () => {
    expect(answer()).toMatch(/contact us as soon as possible/i);
  });

  it('agrees with Terms §5 on the deadline and written-agreement safeguard', () => {
    const answerText = answer();

    // Both surfaces use the same arrival-based deadline.
    for (const text of [terms, answerText]) {
      expect(text).toMatch(/at least 24 hours before the agreed arrival time/i);
      expect(text).not.toMatch(/12(:00)?\s*(noon|pm)|noon the day before/i);
      expect(text).toMatch(/does not limit your statutory cancellation rights/i);
    }

    expect(terms).toMatch(/charge applies only if it was stated and agreed in writing/i);
    expect(answerText).toMatch(/charge applies only if it was stated and agreed in writing/i);
    expect(terms).not.toMatch(/deposit being forfeited|deposit may be non-refundable/i);
  });

  it('keeps the free-reschedule deadline anchored to the Terms section that owns it', () => {
    // Section 5 is the cancellation section; if it is renamed or renumbered the
    // FAQ's "see the cancellation terms" pointer needs revisiting.
    expect(termsSource).toContain("id: 'cancellations'");
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
