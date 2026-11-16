import { describe, it, expect, vi } from 'vitest';
import PDFDocument from 'pdfkit';
import { generateCompletionReportPdf } from '../../../api/_lib/completionReportPdf.js';
import { extractPdfText } from './pdfTextExtract.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const report = (payload = {}, overrides = {}) => ({
  id: 'SAMPLE-REPORT-001', status: 'draft', revision: 1,
  payload: {
    template: 'carpet', customerName: 'Sample Customer', customerEmail: 'private@example.invalid',
    propertyAddress: 'Example property, London', serviceDate: '2026-11-15', jobReference: 'SAMPLE-JOB-001',
    summary: 'Carpet cleaning of the areas listed below.',
    tasks: [{ id: 'one', text: 'Living room carpet cleaned', completed: true }, { id: 'two', text: 'Unperformed stain treatment', completed: false }],
    observations: 'A permanent mark remains near the doorway.', exclusions: 'Furniture moving was excluded.',
    aftercare: 'Allow the carpet to dry before replacing furniture.', internalNotes: 'INTERNAL STAFF NOTE NEVER SHOW', photos: [],
    ...payload,
  }, ...overrides,
});
const countPages = buffer => (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

describe('completion report PDF', () => {
  it('renders a branded one-page small job and excludes private fields', async () => {
    const pdf = await generateCompletionReportPdf(report());
    const text = extractPdfText(pdf);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(countPages(pdf)).toBe(1);
    expect(text).toContain('vve');
    expect(text).toContain('CLEAN');
    expect(text).toContain('PROPERTY');
    expect(text).toContain('SERVICES');
    expect(text).toContain('SAMPLE-JOB-001');
    expect(text).toContain('DRAFT - FOR REVIEW');
    expect(text).toContain('Living room carpet cleaned');
    expect(text).not.toContain('Unperformed stain treatment');
    expect(text).not.toContain('INTERNAL STAFF');
    expect(text).not.toContain('private@example.invalid');
    expect(text).toContain('contact@vveclean.co.uk');
  });

  it('requires a literal true before describing a task as completed', async () => {
    const pdf = await generateCompletionReportPdf(report({ tasks: [{ text: 'Do not infer', completed: 'true' }] }));
    const text = extractPdfText(pdf);
    expect(text).not.toContain('Do not infer');
    expect(text).toContain('No tasks have been marked as completed');
  });

  it('labels final reports without draft wording and includes approval date', async () => {
    const text = extractPdfText(await generateCompletionReportPdf(report({}, { status: 'final', finalised_at: '2026-11-15T11:30:00Z' })));
    expect(text).not.toContain('DRAFT');
    expect(text).toContain('Finalised 15 November 2026');
    expect(text).toContain('11:30');
    expect(text).toContain('not an independent inspection');
  });

  it('paginates long text and unbroken references without crossing body/footer limits', async () => {
    const drawn = [];
    const original = PDFDocument.prototype._fragment;
    const spy = vi.spyOn(PDFDocument.prototype, '_fragment').mockImplementation(function (text, x, y, options) {
      if (String(text).trim()) drawn.push({ text, x, y, font: this._font.name, right: x + this.widthOfString(text, options), page: this.page });
      return original.call(this, text, x, y, options);
    });
    try {
      const pdf = await generateCompletionReportPdf(report({
        observations: 'Recorded observation about the completed cleaning. '.repeat(500),
        exclusions: 'X'.repeat(1200), followUp: 'FINAL FOLLOW-UP SENTINEL',
        propertyAddress: 'Detailed address information '.repeat(60),
      }));
      expect(countPages(pdf)).toBeGreaterThan(5);
      expect(extractPdfText(pdf)).toContain('FINAL FOLLOW-UP SENTINEL');
      for (const line of drawn) {
        expect(line.x).toBeGreaterThanOrEqual(43);
        // The intentionally sheared brand wordmark is a separate typography case.
        if (line.font !== 'BricolageGrotesque') expect(line.right).toBeLessThanOrEqual(552);
        expect(line.y).toBeLessThanOrEqual(810);
        expect(line.y > 763 && line.y < 790).toBe(false);
      }
    } finally { spy.mockRestore(); }
  });

  it('renders before/after pairs and explicitly labelled unpaired photos', async () => {
    const photos = [
      { id: 'a', stage: 'after', pairId: 'living-room', caption: 'After cleaning' },
      { id: 'b', stage: 'before', pairId: 'living-room', caption: 'Before cleaning' },
      { id: 'c', stage: 'before', caption: 'Doorway before only' },
      { id: 'd', stage: 'area', caption: 'Persistent mark recorded' },
    ];
    const pdf = await generateCompletionReportPdf(report({ photos }), { photoBuffers: { a: png, b: png, c: png, d: png } });
    const text = extractPdfText(pdf);
    expect(text).toContain('Before and after');
    expect(text.indexOf('Before cleaning')).toBeLessThan(text.indexOf('After cleaning'));
    expect(text).toContain('Doorway before only');
    expect(text).toContain('AREA PHOTOGRAPH');
    expect(countPages(pdf)).toBeGreaterThan(1);
  });

  it('does not invent a comparison from ambiguous pair assignments', async () => {
    const photos = [ { id: 'a', stage: 'before', pairId: 'one' }, { id: 'b', stage: 'before', pairId: 'one' } ];
    const pdf = await generateCompletionReportPdf(report({ photos }), { photoBuffers: new Map([['a', png], ['b', png]]) });
    expect(extractPdfText(pdf)).not.toContain('Before and after');
  });

  it('keeps very long photo captions instead of clipping them', async () => {
    const pdf = await generateCompletionReportPdf(report({ photos: [{ id: 'a', stage: 'after', caption: `${'Photographic observation. '.repeat(150)}CAPTION-END` }] }), { photoBuffers: { a: png } });
    expect(extractPdfText(pdf)).toContain('CAPTION-END');
    expect(countPages(pdf)).toBeGreaterThan(1);
  });

  it('rejects missing photographs rather than producing incomplete evidence', async () => {
    await expect(generateCompletionReportPdf(report({ photos: [{ id: 'missing', stage: 'after' }] }))).rejects.toThrow('photograph is unavailable');
  });

  it('rejects invalid image bytes', async () => {
    await expect(generateCompletionReportPdf(report({ photos: [{ id: 'a', stage: 'after' }] }), { photoBuffers: { a: Buffer.from('not an image') } })).rejects.toThrow();
  });

  it('uses supplied originals only and never fetches photograph URLs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(generateCompletionReportPdf(report({ photos: [{ id: 'a', objectKey: 'https://example.invalid/private', stage: 'area' }] }))).rejects.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
