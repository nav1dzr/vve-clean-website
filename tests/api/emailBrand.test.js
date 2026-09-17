import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emailWordmarkHtml } from '../../api/_lib/emailBrand.js';
import { emailWordmarkHtml as adminEmailWordmarkHtml, BRAND_BLUE } from '../../admin/api/_lib/brandWordmark.js';

describe('customer email brand wordmark', () => {
  it('renders the current blue wordmark on light backgrounds', () => {
    const html = emailWordmarkHtml();
    expect(html).toContain('aria-label="VVE Clean"');
    expect(html).toContain('>vve</td>');
    expect(html).toContain('>CLEAN</td>');
    expect(html).toContain('#1268D9');
    expect(html).toContain('CLEANING &amp;<br>PROPERTY<br>SERVICES');
    expect(html).toContain('border-left:2px solid #CBD5E1');
    expect(html).toContain('color:#12356D');
    expect(html).toContain('width:240px;max-width:100%');
    expect(html).not.toContain('#b8960c');
  });

  it('renders the approved inverse lockup for the navy email header', () => {
    const html = emailWordmarkHtml({ inverse: true });
    expect(html).toContain('#FFFFFF');
    expect(html).toContain('#7DD3FC');
    expect(html).toContain('CLEANING &amp;<br>PROPERTY<br>SERVICES');
    expect(html).toContain('border-left:2px solid #7DD3FC');
    expect(html).not.toContain('#b8960c');
  });

  it.each([false, true])('keeps the separately deployed CRM email lockup aligned (inverse=%s)', (inverse) => {
    expect(adminEmailWordmarkHtml({ inverse })).toBe(emailWordmarkHtml({ inverse }));
    expect(BRAND_BLUE).toBe('#1268D9');
  });

  it.each([
    ['admin/api/_lib/enquiryNotifications.js', "import { emailWordmarkHtml } from './brandWordmark.js';"],
    ['api/stripe-webhook.js', "import { emailWordmarkHtml } from './_lib/emailBrand.js';"],
  ])(
    '%s uses the shared email wordmark',
    (path, sharedImport) => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).toContain(sharedImport);
      expect(source).toContain('emailWordmarkHtml({ inverse: true })');
    },
  );
});
