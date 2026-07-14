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
