import { describe, it, expect } from 'vitest';
import { buildClientPackEmail } from '../../../api/_lib/clientPackEmail.js';
const input = { title: 'The Hart', serviceDate: '2026-11-10', greeting: 'Hi Dani', viewUrl: `https://admin.vveclean.co.uk/report-view#${'a'.repeat(43)}` };
describe('client pack email', () => {
  it('renders image-free HTML and the same private link in plain text', () => {
    const result = buildClientPackEmail(input);
    expect(result.html).not.toMatch(/<img|data:image|cid:/);
    expect(result.html).toContain(input.viewUrl);
    expect(result.text).toContain(input.viewUrl);
    expect(result.subject).toContain('10 November 2026');
  });
  it('escapes user content', () => {
    expect(buildClientPackEmail({ ...input, title: '<script>evil</script>' }).html).not.toContain('<script>');
  });
  it.each(['https://evil.test/report-view#'+'a'.repeat(43), 'javascript:alert(1)', 'https://admin.vveclean.co.uk/report-view', 'https://admin.vveclean.co.uk/report-view?token=secret#'+'a'.repeat(43)])('rejects unsafe or incomplete links %s', viewUrl => {
    expect(() => buildClientPackEmail({ ...input, viewUrl })).toThrow();
  });
  it('rejects invalid dates', () => expect(() => buildClientPackEmail({ ...input, serviceDate: '2026-02-31' })).toThrow());
});
