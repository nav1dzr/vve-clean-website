// Standalone work evidence, deliberately independent of invoice/receipt state.
// Only explicitly checked tasks are described as completed. Private originals
// are supplied by the authorised caller: this renderer never fetches URLs.
import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBusinessSettings } from './businessSettings.js';

const FONT_URL = new URL('./assets/BricolageGrotesque.ttf', import.meta.url);
const FONT = FONT_URL.protocol === 'file:' ? readFileSync(FONT_URL)
  : readFileSync(join(process.cwd(), 'api', '_lib', 'assets', 'BricolageGrotesque.ttf'));
const MARGIN = 44;
const BOTTOM = 763;
const NAVY = '#102d49';
const BLUE = '#1268d9';
const INK = '#24384b';
const MUTED = '#52677c';
const TINT = '#eef5fc';
const BORDER = '#dce5ed';

function clean(value) {
  return Array.from(String(value || '')).filter(char => char.charCodeAt(0) >= 32 || '\n\r\t'.includes(char)).join('').replace(/\r\n?/g, '\n');
}

function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return clean(value);
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? clean(value)
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}

function wrap(doc, value, width) {
  const lines = [];
  for (const paragraph of clean(value).split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && doc.widthOfString(`${line} ${word}`) > width) { lines.push(line); line = ''; }
      if (doc.widthOfString(word) <= width) { line += `${line ? ' ' : ''}${word}`; continue; }
      // Unbroken references/URLs must never escape the content column.
      for (const char of word) {
        if (line && doc.widthOfString(line + char) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

function photoBuffer(photoBuffers, photo) {
  const get = key => photoBuffers instanceof Map ? photoBuffers.get(key) : photoBuffers?.[key];
  const buffer = get(photo.id) || get(photo.objectKey);
  if (!Buffer.isBuffer(buffer)) throw new Error('A report photograph is unavailable. Retry after checking its upload.');
  return buffer;
}

export async function generateCompletionReportPdf(report, { photoBuffers = {} } = {}) {
  const data = report?.payload || {};
  const isDraft = report?.status !== 'final';
  const settings = getBusinessSettings();
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, compress: false,
    info: { Title: 'Cleaning completion report', Author: settings.tradingName, Subject: 'Recorded cleaning work and observations' } });
  doc.registerFont('VVEBrand', FONT);
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - MARGIN * 2;
  let y;
  const text = (value, x, yy, size = 10, color = INK, font = 'Helvetica') => {
    doc.font(font).fontSize(size).fillColor(color).text(clean(value), x, yy, { lineBreak: false });
  };
  function header(first) {
    doc.rect(0, 0, doc.page.width, 5).fill(BLUE);
    // Equal-width VVE/CLEAN rows, no decorative rules beside the wordmark.
    doc.font('VVEBrand').fontSize(33);
    const markWidth = doc.widthOfString('vve', { characterSpacing: -3 });
    doc.save().transform(1, 0, -0.14, 1, 5.3, 0);
    doc.fillColor(BLUE).text('vve', MARGIN, 38, { characterSpacing: -3, lineBreak: false });
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(7.5);
    const spacing = (markWidth - doc.widthOfString('CLEAN')) / 4;
    doc.fillColor(BLUE).text('CLEAN', MARGIN, 73, { characterSpacing: spacing, lineBreak: false });
    doc.moveTo(MARGIN + markWidth + 18, 40).lineTo(MARGIN + markWidth + 18, 83).lineWidth(1.5).strokeColor(BORDER).stroke();
    text('CLEANING &', MARGIN + markWidth + 30, 41, 10, NAVY, 'Helvetica-Bold');
    text('PROPERTY', MARGIN + markWidth + 30, 55, 10, NAVY, 'Helvetica-Bold');
    text('SERVICES', MARGIN + markWidth + 30, 69, 10, NAVY, 'Helvetica-Bold');
    const rightX = MARGIN + width - 173;
    text(isDraft ? 'DRAFT - FOR REVIEW' : 'CLEANING RECORD', rightX, 43, 8, isDraft ? '#856418' : BLUE, 'Helvetica-Bold');
    doc.font('Helvetica').fontSize(8.5);
    const reference = clean(data.jobReference || report?.id || 'Not assigned');
    const refLines = wrap(doc, reference, 173);
    // Full reference is repeated in the flowing details below, even if long.
    refLines.slice(0, 2).forEach((line, i) => text(line, rightX, 60 + i * 12, 8.5, MUTED));
    doc.moveTo(MARGIN, 99).lineTo(MARGIN + width, 99).lineWidth(0.7).strokeColor(BORDER).stroke();
    if (first) {
      text('Cleaning completion report', MARGIN, 119, 24, NAVY, 'Helvetica-Bold');
      text(isDraft ? 'Review the recorded work before finalising.' : 'Work recorded by VVE Clean', MARGIN, 151, 9, MUTED);
      y = 179;
    } else {
      text('Cleaning completion report · continued', MARGIN, 114, 11, NAVY, 'Helvetica-Bold');
      y = 140;
    }
  }
  function ensure(height) {
    if (y + height <= BOTTOM) return;
    doc.addPage();
    header(false);
  }
  function body(value, { x = MARGIN, lineWidth = width, font = 'Helvetica', color = INK, size = 10, gap = 14 } = {}) {
    doc.font(font).fontSize(size);
    const lines = wrap(doc, value, lineWidth);
    for (const line of lines) { ensure(gap); text(line, x, y, size, color, font); y += gap; }
  }
  function section(title, value) {
    if (!clean(value).trim()) return;
    ensure(52);
    doc.roundedRect(MARGIN, y, width, 24, 4).fill(TINT);
    text(title, MARGIN + 10, y + 7, 10, NAVY, 'Helvetica-Bold');
    y += 34;
    body(value);
    y += 14;
  }

  try {
    header(true);
    const details = [
      data.customerName && `Client: ${clean(data.customerName)}`,
      data.propertyAddress && `Property: ${clean(data.propertyAddress)}`,
      data.serviceDate && `Service date: ${dateLabel(data.serviceDate)}`,
      `Job reference: ${clean(data.jobReference || report?.id || 'Not assigned')}`,
    ].filter(Boolean);
    details.forEach(line => { body(line, { size: 10, gap: 15 }); y += 3; });
    y += 12;
    section('Service summary', data.summary);
    const completed = (Array.isArray(data.tasks) ? data.tasks : []).filter(task => task.completed === true && clean(task.text).trim());
    section('Work recorded as completed', completed.length ? completed.map(task => `• ${clean(task.text)}`).join('\n') : 'No tasks have been marked as completed in this report.');
    section('Cleaning observations', data.observations);
    section('Outstanding issues and exclusions', data.exclusions);
    section('Aftercare recommendations', data.aftercare);
    section('Optional follow-up', data.followUp);

    const finalised = report?.finalised_at || report?.finalized_at;
    if (!isDraft && finalised) {
      const stamp = new Date(finalised);
      if (!Number.isNaN(stamp.getTime())) {
        ensure(30);
        body(`Finalised ${stamp.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'long', timeStyle: 'short' })} (London time)`, { size: 8, color: MUTED, gap: 12 });
        y += 8;
      }
    }
    section('About this report', 'This report records the work and observations entered by VVE Clean. It is not an independent inspection, a payment receipt or a guarantee of tenancy deposit release.');

    const photos = Array.isArray(data.photos) ? data.photos : [];
    if (photos.length) {
      // Pair only explicit, unique before/after matches. Unpaired photographs
      // remain clearly labelled individual records, never invented comparisons.
      const used = new Set();
      const groups = [];
      for (let i = 0; i < photos.length; i++) {
        if (used.has(i)) continue;
        const photo = photos[i];
        const indices = photos.map((p, idx) => p.pairId && p.pairId === photo.pairId ? idx : -1).filter(idx => idx >= 0);
        const before = indices.filter(idx => photos[idx].stage === 'before');
        const after = indices.filter(idx => photos[idx].stage === 'after');
        if (photo.pairId && indices.length === 2 && before.length === 1 && after.length === 1) {
          groups.push([photos[before[0]], photos[after[0]]]); indices.forEach(idx => used.add(idx));
        } else { groups.push([photo]); used.add(i); }
      }
      for (const group of groups) {
        const gap = 16;
        const imageWidth = (width - (group.length - 1) * gap) / group.length;
        const imageHeight = group.length === 2 ? 166 : 220;
        doc.font('Helvetica').fontSize(9);
        const captions = group.map(photo => wrap(doc, photo.caption || 'Photograph supplied by the team', imageWidth - 16));
        const capHeight = Math.max(...captions.map(lines => lines.length)) * 13;
        // Very long captions move to a flowing section, preserving all text.
        const separateCaption = capHeight > 104;
        const blockHeight = 42 + imageHeight + (separateCaption ? 0 : capHeight + 12);
        ensure(blockHeight + 12);
        text(group.length === 2 ? 'Before and after' : 'Photographic record', MARGIN, y, 12, NAVY, 'Helvetica-Bold');
        y += 25;
        group.forEach((photo, index) => {
          const x = MARGIN + index * (imageWidth + gap);
          const label = photo.stage === 'before' ? 'BEFORE' : photo.stage === 'after' ? 'AFTER' : 'AREA PHOTOGRAPH';
          text(label, x, y, 8, BLUE, 'Helvetica-Bold');
          doc.roundedRect(x, y + 17, imageWidth, imageHeight, 4).fill('#f2f5f8');
          const buffer = photoBuffer(photoBuffers, photo);
          doc.image(buffer, x + 5, y + 22, { fit: [imageWidth - 10, imageHeight - 10], align: 'center', valign: 'center' });
          if (!separateCaption) captions[index].forEach((line, n) => text(line, x + 8, y + 25 + imageHeight + n * 13, 9, MUTED));
        });
        y += 17 + imageHeight + (separateCaption ? 12 : capHeight + 22);
        if (separateCaption) group.forEach(photo => section(`${photo.stage === 'before' ? 'Before' : photo.stage === 'after' ? 'After' : 'Photograph'} - notes`, photo.caption));
        y += 12;
      }
    }


    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(MARGIN, 784).lineTo(MARGIN + width, 784).lineWidth(0.7).strokeColor(BORDER).stroke();
      text(`${settings.phone}  ·  ${settings.email}`, MARGIN, 796, 8, MUTED);
      text(settings.website, MARGIN, 809, 8, MUTED);
      text(`${i + 1} / ${range.count}`, MARGIN + width - 35, 803, 8, MUTED);
    }
    doc.end();
    return await finished;
  } catch (error) {
    // Consume the stream without returning a partial report.
    doc.end();
    await finished.catch(() => {});
    throw error;
  }
}
