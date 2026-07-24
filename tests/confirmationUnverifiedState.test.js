import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// confirmation.html used to show the success checkmark unconditionally, even
// with no ref/token/sid in the URL at all (no evidence of payment). These
// are structural checks (not full DOM execution, since the toggle logic is
// inline in a large non-modular script) that the fix is present and that it
// never touches payment verification or the Ads conversion pipeline.
function read() {
  return readFileSync(resolve(process.cwd(), 'public/confirmation.html'), 'utf8');
}

describe('confirmation.html — does not show success before any evidence of payment', () => {
  it('has an "unverified" state block, hidden by default', () => {
    const html = read();
    expect(html).toMatch(/id="unverified-state"\s+style="display:none/);
  });

  it('wraps the success content in a container that can be hidden', () => {
    const html = read();
    expect(html).toMatch(/<div id="verified-content">/);
  });

  it('shows the unverified state and hides the verified content only when both ref and sid are absent', () => {
    const html = read();
    const block = html.slice(html.indexOf('if (ref || sid) {'), html.indexOf('if (ref || sid) {') + 700);
    expect(block).toMatch(/verified\.style\.display\s*=\s*"none"/);
    expect(block).toMatch(/unverified\.style\.display\s*=\s*""/);
  });

  it('the verified/unverified toggle does not call fetch, verify-payment, or gtag', () => {
    const html = read();
    const block = html.slice(html.indexOf('Verified vs unverified content toggle'), html.indexOf('if (ref || sid) {') + 400);
    expect(block).not.toMatch(/verify-payment/);
    expect(block).not.toMatch(/gtag\(/);
  });

  it('initially hides verified-content when ref or sid is present, before payment is verified', () => {
    const html = read();
    const ifBlock = html.slice(html.indexOf('if (ref || sid) {'), html.indexOf('if (ref || sid) {') + 400);
    // The if-branch must initially hide verified-content and show the checking state
    expect(ifBlock).toMatch(/verified.*style\.display\s*=\s*"none"/);
    expect(ifBlock).toMatch(/payment-checking/);
  });

  it('has a payment-checking element hidden by default', () => {
    const html = read();
    expect(html).toMatch(/id="payment-checking"\s+style="display:none/);
  });

  it('has a payment-unverified element for when verify-payment returns paid:false', () => {
    const html = read();
    expect(html).toMatch(/id="payment-unverified"\s+style="display:none/);
  });

  it('initVerifyUI shows verified-content and clears the draft when paid:true', () => {
    const html = read();
    const fn = html.slice(html.indexOf('function initVerifyUI'), html.indexOf('function initVerifyUI') + 1200);
    expect(fn).toMatch(/verified.*style\.display\s*=\s*""/);
    expect(fn).toMatch(/localStorage\.removeItem\("vve_form_draft_v1"\)/);
  });

  it('initVerifyUI shows payment-unverified when paid:false or on error', () => {
    const html = read();
    const fn = html.slice(html.indexOf('function initVerifyUI'), html.indexOf('function initVerifyUI') + 1200);
    // Check both parts separately — they may be on different lines
    expect(fn).toMatch(/payment-unverified/);
    expect(fn).toMatch(/style\.display\s*=\s*""/);
  });

  it('initVerifyUI never calls gtag or fires a conversion event', () => {
    const html = read();
    const fnStart = html.indexOf('function initVerifyUI');
    // Find the conversion-tracking IIFE comment that immediately follows the function —
    // robust to CRLF line endings (no \n\n dependency).
    const fnEnd = html.indexOf('Conversion tracking', fnStart);
    const fn    = fnStart >= 0 && fnEnd > fnStart
      ? html.slice(fnStart, fnEnd)
      : html.slice(fnStart, fnStart + 1000);
    expect(fn).not.toMatch(/gtag\(/);
    expect(fn).not.toMatch(/FIRING/);
  });

  it('the unverified state offers a WhatsApp support link and a way back home, not a fabricated booking summary', () => {
    const html = read();
    const start = html.indexOf('id="unverified-state"');
    const end = html.indexOf('<!-- Success hero -->');
    const unverifiedBlock = html.slice(start, end);
    expect(unverifiedBlock).toMatch(/wa\.me\/447845451111/);
    expect(unverifiedBlock).toMatch(/couldn(&rsquo;|')t verify this payment/i);
    expect(unverifiedBlock).not.toMatch(/id="ref-card"|Your booking reference/);
  });
});
