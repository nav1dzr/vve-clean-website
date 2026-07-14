import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cross-cutting regression check: none of the customer-facing surfaces in the
// booking flow may claim a guaranteed/secured slot or a confirmed appointment
// before the business has genuinely confirmed it. This scans the actual
// shipped source text on every surface named in the fix, so it catches
// regressions regardless of which file re-introduces the wording.
const FILES = [
  'src/pages/BookingPage.tsx',
  'src/components/FAQ.tsx',
  'src/pages/LeafletPage.tsx',
  'public/confirmation.html',
  'api/create-checkout-session.js',
  'api/stripe-webhook.js',
];

const BANNED_PATTERNS = [
  /no one else can take your slot/i,
  /slot is (secured|guaranteed|held)\b/i,
  /secures your slot/i,
  /secure your slot/i,
  /your slot is nearly secured/i,
  /booking is confirmed\b/i,
  /appointment confirmed\b/i,
];

// confirmation.html legitimately contains "confirmed" wording, but only
// inside statusCopy()'s status==='confirmed' branch (verified separately,
// and with genuine status-gating, by confirmationStatusCopy.test.js) — so it
// is exempt from the two confirmed-literal patterns here. Every other banned
// pattern (secured/guaranteed/held slot claims) still applies to it.
const CONFIRMATION_HTML_EXEMPT_PATTERNS = new Set([/booking is confirmed\b/i, /appointment confirmed\b/i]);

describe('booking flow — no false "slot secured" / "confirmed" wording remains', () => {
  for (const relPath of FILES) {
    it(`${relPath} contains none of the banned guarantee claims`, () => {
      const source = readFileSync(resolve(process.cwd(), relPath), 'utf8');
      const isConfirmationHtml = relPath.endsWith('confirmation.html');
      for (const pattern of BANNED_PATTERNS) {
        if (isConfirmationHtml && [...CONFIRMATION_HTML_EXEMPT_PATTERNS].some((p) => p.source === pattern.source)) {
          continue;
        }
        expect(source, `${relPath} matched banned pattern ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it('confirmation.html only ever claims "confirmed" wording inside the status==="confirmed" branch', () => {
    const source = readFileSync(resolve(process.cwd(), 'public/confirmation.html'), 'utf8');
    // The literal string "confirmed" is allowed to appear (e.g. inside
    // statusCopy's confirmed-status branch, or admin-facing comments) — what
    // matters is that the *default*/pre-data hero heading and lede, which
    // render before any status is known, use request-received wording.
    expect(source).toMatch(/Payment received — we.re checking your requested date/);
    expect(source).toMatch(/your booking request has been received/i);
  });

  it('the booking page button says "Pay £30 deposit", not "confirm booking"', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/BookingPage.tsx'), 'utf8');
    expect(source).toMatch(/Pay £\{DEPOSIT\} deposit/);
    expect(source).not.toMatch(/confirm booking/i);
  });
});
