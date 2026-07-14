import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Extracts and executes the real `statusCopy` function straight out of the
// shipped confirmation.html, rather than hand-duplicating its logic here —
// this way the test always exercises the exact code the customer's browser
// runs, with no risk of a copy drifting out of sync with the original.
function loadStatusCopy() {
  const html = readFileSync(resolve(process.cwd(), 'public/confirmation.html'), 'utf8');
  const match = html.match(/function statusCopy\(status\) \{[\s\S]*?\n  \}/);
  if (!match) throw new Error('Could not find statusCopy() in public/confirmation.html');
  return new Function(`return (${match[0]});`)();
}

describe('confirmation.html — statusCopy (confirmed vs. request-received wording)', () => {
  const statusCopy = loadStatusCopy();

  it('uses "Payment received — we\'re checking your requested date" for the default/new status', () => {
    const copy = statusCopy('new');
    expect(copy.heading).toBe('Payment received — we’re checking your requested date');
    expect(copy.lede).toMatch(/booking request has been received/i);
    expect(copy.lede).not.toMatch(/appointment is confirmed/i);
  });

  it('uses the same request-received wording for an empty/unknown status', () => {
    for (const status of ['', undefined, null, 'pending', 'scheduled']) {
      const copy = statusCopy(status);
      expect(copy.heading).toBe('Payment received — we’re checking your requested date');
    }
  });

  it('only switches to confirmed wording when status is exactly "confirmed"', () => {
    const copy = statusCopy('confirmed');
    expect(copy.heading).toBe('You’re all booked in!');
    expect(copy.lede).toMatch(/appointment is confirmed/i);
  });

  it('never claims "no one else can take your slot" in any state', () => {
    for (const status of ['new', 'confirmed', '', undefined]) {
      const copy = statusCopy(status);
      expect(copy.heading + ' ' + copy.lede + ' ' + copy.nextStepLabel).not.toMatch(/no one else can take your slot/i);
    }
  });
});
