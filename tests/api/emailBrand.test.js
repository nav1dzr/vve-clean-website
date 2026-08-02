import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emailWordmarkHtml } from '../../api/_lib/emailBrand.js';

describe('customer email brand wordmark', () => {
  it('renders the current blue wordmark on light backgrounds', () => {
    const html = emailWordmarkHtml();
    expect(html).toContain('aria-label="VVE Clean"');
    expect(html).toContain('>vve</td>');
    expect(html).toContain('>CLEAN</td>');
    expect(html).toContain('#1268D9');
    expect(html).not.toContain('#b8960c');
  });

  it('renders the approved inverse lockup for the navy email header', () => {
    const html = emailWordmarkHtml({ inverse: true });
    expect(html).toContain('#FFFFFF');
    expect(html).toContain('#7DD3FC');
    expect(html).not.toContain('#b8960c');
  });

  it.each(['api/contact.js', 'api/stripe-webhook.js'])(
    '%s uses the shared email wordmark',
    (path) => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).toContain("import { emailWordmarkHtml } from './_lib/emailBrand.js';");
      expect(source).toContain('emailWordmarkHtml({ inverse: true })');
    },
  );
});
