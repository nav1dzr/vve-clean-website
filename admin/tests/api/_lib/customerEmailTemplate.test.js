import { describe, it, expect } from 'vitest';
import { validateCustomerEmail, buildCustomerEmail } from '../../../api/_lib/customerEmailTemplate.js';
const settings = { tradingName: 'VVE Clean', legalName: 'VVE Limited', companyNumber: '17234391', phone: '020 8050 2233' };
const input = { recipient: 'client@example.com', subject: 'Your quotation', body: 'Good morning,\n\nPlease find our quotation.\n\nKind regards,\nNavid', style: 'simple' };
describe('customer correspondence templates', () => {
  it('keeps a personal email simple with a contact reply footer and text alternative', () => {
    const email = buildCustomerEmail(input, settings);
    expect(email.html).toContain('Good morning,');
    expect(email.html).toContain('contact@vveclean.co.uk');
    expect(email.html).not.toContain('aria-label="VVE Clean"');
    expect(email.text).toContain('Kind regards,\nNavid');
    expect(email.html).not.toContain('unsubscribe');
    expect(email.html).not.toContain('admin@');
  });
  it('renders the full brand and the supplied comparison without changing prices or terms', () => {
    const email = buildCustomerEmail({ ...input, style: 'branded', body: '# Options\n\n| Item | A | B |\n|---|---:|---:|\n| Total | **£10,950** | **£7,720** |\n\n- 30 days\n- Five working days' }, settings);
    expect(email.html).toContain('CLEANING &amp;');
    expect(email.html).toContain('PROPERTY');
    expect(email.html).toContain('<th');
    expect(email.html).toContain('<strong>£10,950</strong>');
    expect(email.html).toContain('£7,720');
    expect(email.text).toContain('30 days');
    expect(email.html).not.toContain('£30');
  });
  it('escapes HTML, images and hostile markup in every body/heading/table cell', () => {
    const email = buildCustomerEmail({ ...input, body: '# <script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n| X |\n|---|\n| <iframe> |\n\n**<b>**' }, settings);
    expect(email.fragment).not.toMatch(/<(script|img|iframe|b)(?:\s|>)/);
    expect(email.fragment).toContain('&lt;script&gt;');
    expect(email.fragment).toContain('&lt;iframe&gt;');
  });
  it.each(['a@example.com,b@example.com', 'Name <a@example.com>', 'a@example.com\r\nBcc: x@example.com', 'a@localhost'])('rejects unsafe recipient %s', recipient => {
    expect(validateCustomerEmail({ ...input, recipient }).ok).toBe(false);
  });
  it.each([{ subject: 'a\nBcc: b' }, { body: 'a'.repeat(20001) }, { subject: '' }, { body: '' }, { style: 'html' }])('rejects invalid content %o', patch => {
    expect(validateCustomerEmail({ ...input, ...patch }).ok).toBe(false);
  });
  it('normalises line endings without rewriting the message', () => {
    expect(validateCustomerEmail({ ...input, body: ' Line 1\r\nLine 2 ' }).value.body).toBe('Line 1\nLine 2');
  });
});
