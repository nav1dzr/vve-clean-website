// Server-side PDF rendering for invoices and receipts.
//
// Library choice: pdfkit — pure-JS, no Chromium/Puppeteer dependency (fits
// the existing lightweight serverless functions; avoids the cold-start and
// bundle-size cost a headless-browser approach would add to a Hobby-plan
// Vercel project), deterministic vector output, well-suited to a
// fixed-layout business document. See
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §8.
//
// Only the built-in Helvetica family is used — no remote/embedded fonts,
// so output is deterministic and has no network dependency at render time.
// All customer-controlled text is rendered as literal PDF text via
// pdfkit's .text() calls, never interpreted as markup, so there is no
// injection surface analogous to the HTML-escaping needed in email
// templates (api/stripe-webhook.js's escHtml() pattern) — pdfkit has no
// concept of "unescaped" text to begin with.

import PDFDocument from 'pdfkit';
import { buildPaymentInstructionsSnapshot } from './paymentOptions.js';
import { hasBankDetails } from './businessSettings.js';

const PAGE_MARGIN = 50;
const NAVY = '#020b24';
const GOLD = '#b8960c';
const GREY = '#666666';
const LIGHT_GREY = '#999999';
const BORDER = '#dddddd';

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function money(settings, amount) {
  const value = Number(amount || 0);
  return `${settings.currencySymbol || '£'}${value.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function drawWordmark(doc, x, y) {
  doc.font('Helvetica-Bold').fontSize(20);
  doc.fillColor(NAVY).text('V', x, y, { continued: true });
  doc.fillColor(GOLD).text('V', { continued: true });
  doc.fillColor(NAVY).text('E', { continued: false });
  doc.font('Helvetica').fontSize(8).fillColor(GREY).text('CLEAN', x, y + 22);
}

function drawBusinessBlock(doc, settings, x, y, width) {
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  const lines = [
    settings.tradingName,
    settings.legalName !== settings.tradingName ? settings.legalName : null,
    settings.companyNumber ? `Company No. ${settings.companyNumber}` : null,
    settings.registeredAddress,
    settings.phone,
    settings.email,
    settings.website,
    settings.vatEnabled && settings.vatNumber ? `VAT No. ${settings.vatNumber}` : null,
  ].filter(Boolean);
  doc.text(lines.join('\n'), x, y, { width, align: 'right' });
}

function drawDraftWatermark(doc) {
  doc.save();
  doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.font('Helvetica-Bold').fontSize(90).fillColor('#f0d9d9').opacity(0.5);
  doc.text('DRAFT', 0, doc.page.height / 2 - 60, { width: doc.page.width, align: 'center' });
  doc.opacity(1);
  doc.restore();
}

function addFooter(doc, settings) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.height - PAGE_MARGIN + 15;
    doc.font('Helvetica').fontSize(8).fillColor(LIGHT_GREY);
    doc.text(
      `${settings.tradingName} · ${settings.website} · ${settings.phone}`,
      PAGE_MARGIN, bottom, { width: doc.page.width - PAGE_MARGIN * 2, align: 'left' },
    );
    doc.text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, bottom, { width: doc.page.width - PAGE_MARGIN * 2, align: 'right' });
  }
}

function drawItemsTable(doc, items, settings, startY) {
  const tableX = PAGE_MARGIN;
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const cols = {
    description: { x: tableX, width: tableWidth * 0.46 },
    qty: { x: tableX + tableWidth * 0.46, width: tableWidth * 0.1 },
    unitPrice: { x: tableX + tableWidth * 0.56, width: tableWidth * 0.16 },
    discount: { x: tableX + tableWidth * 0.72, width: tableWidth * 0.13 },
    total: { x: tableX + tableWidth * 0.85, width: tableWidth * 0.15 },
  };

  let y = startY;
  const rowHeaderHeight = 20;

  function drawHeader() {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY);
    doc.text('Description', cols.description.x, y, { width: cols.description.width });
    doc.text('Qty', cols.qty.x, y, { width: cols.qty.width, align: 'right' });
    doc.text('Unit price', cols.unitPrice.x, y, { width: cols.unitPrice.width, align: 'right' });
    doc.text('Discount', cols.discount.x, y, { width: cols.discount.width, align: 'right' });
    doc.text('Total', cols.total.x, y, { width: cols.total.width, align: 'right' });
    y += rowHeaderHeight;
    doc.moveTo(tableX, y).lineTo(tableX + tableWidth, y).strokeColor(BORDER).stroke();
    y += 6;
  }

  drawHeader();

  doc.font('Helvetica').fontSize(9).fillColor('#222222');
  for (const item of items) {
    const descHeight = doc.heightOfString(item.description || '', { width: cols.description.width });
    const rowHeight = Math.max(descHeight, 14) + 8;

    if (y + rowHeight > doc.page.height - PAGE_MARGIN - 100) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeader();
      doc.font('Helvetica').fontSize(9).fillColor('#222222');
    }

    doc.text(item.description || '', cols.description.x, y, { width: cols.description.width });
    doc.text(String(item.quantity), cols.qty.x, y, { width: cols.qty.width, align: 'right' });
    doc.text(money(settings, item.unit_price ?? item.unitPrice), cols.unitPrice.x, y, { width: cols.unitPrice.width, align: 'right' });
    doc.text(
      (item.line_discount ?? item.lineDiscount) ? money(settings, item.line_discount ?? item.lineDiscount) : '—',
      cols.discount.x, y, { width: cols.discount.width, align: 'right' },
    );
    doc.text(money(settings, item.line_total ?? item.lineTotal), cols.total.x, y, { width: cols.total.width, align: 'right' });
    y += rowHeight;
  }

  doc.moveTo(tableX, y).lineTo(tableX + tableWidth, y).strokeColor(BORDER).stroke();
  return y + 10;
}

// An issued invoice carries its own frozen payment_instructions_snapshot
// (set at issue time — see the migration file header); a draft preview (or
// any older issued row from before this field existed) has none yet, so
// it's computed on the fly from the invoice's own payment_option/
// stripe_payment_link_url plus the settings already passed in — the same
// "live for a draft, frozen for issued" split every other field in this
// renderer already follows.
function resolvePaymentInstructions(invoice, settings) {
  if (invoice.payment_instructions_snapshot) return invoice.payment_instructions_snapshot;
  return buildPaymentInstructionsSnapshot({
    paymentOption: invoice.payment_option || 'bank_transfer',
    stripePaymentLinkUrl: invoice.stripe_payment_link_url,
    settings,
    hasBankDetails: hasBankDetails(settings),
  });
}

function drawServiceAddressBlock(doc, invoice, x, y, width) {
  const hasServiceInfo = invoice.service_contact_name || invoice.service_address
    || invoice.service_contact_email || invoice.service_contact_phone || invoice.service_contact_postcode;
  if (!hasServiceInfo) return y;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Service address', x, y);
  doc.font('Helvetica').fontSize(9.5).fillColor('#222222').text(
    [invoice.service_contact_name, invoice.service_address, invoice.service_contact_postcode, invoice.service_contact_email, invoice.service_contact_phone]
      .filter(Boolean).join('\n'),
    x, y + 14, { width },
  );
  return y + 14 + doc.heightOfString('x', { width }) * 5 + 14;
}

// Renders the bank-transfer block and/or the "Pay securely by Stripe" link,
// governed entirely by resolvePaymentInstructions() — never both unless
// paymentOption is 'both', never a blank/broken section when nothing is
// configured (same "omit, don't fabricate" rule as the business block).
function drawPaymentInstructionsBlock(doc, invoice, settings, startY) {
  const instructions = resolvePaymentInstructions(invoice, settings);
  let y = startY;

  if (instructions.bankDetails) {
    y += 20;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Payment details — bank transfer', PAGE_MARGIN, y);
    y += 14;
    doc.font('Helvetica').fontSize(9).fillColor('#222222').text(
      `${instructions.bankDetails.accountName} · Sort code ${instructions.bankDetails.sortCode} · Account ${instructions.bankDetails.accountNumber}`,
      PAGE_MARGIN, y,
    );
    y += 14;
    if (instructions.bankDetails.referenceInstructions) {
      doc.text(instructions.bankDetails.referenceInstructions, PAGE_MARGIN, y, { width: doc.page.width - PAGE_MARGIN * 2 });
      y += 14;
    }
  }

  if (instructions.stripePaymentLinkUrl) {
    y += instructions.bankDetails ? 10 : 20;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Payment details — card', PAGE_MARGIN, y);
    y += 14;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0a5cd8').text(
      'Pay securely by Stripe',
      PAGE_MARGIN, y,
      { link: instructions.stripePaymentLinkUrl, underline: true },
    );
    y += 14;
  }

  return y;
}

function drawTotalsBlock(doc, invoice, settings, startY) {
  const width = 220;
  const x = doc.page.width - PAGE_MARGIN - width;
  let y = startY;

  const rows = [
    ['Subtotal', money(settings, invoice.subtotal)],
    invoice.document_discount ? ['Discount', `−${money(settings, invoice.document_discount)}`] : null,
    settings.vatEnabled ? ['VAT', money(settings, invoice.tax_total)] : null,
    ['Total', money(settings, invoice.total)],
    invoice.deposit_applied ? ['Deposit already paid', `−${money(settings, invoice.deposit_applied)}`] : null,
    invoice.amount_paid ? ['Payments received', `−${money(settings, invoice.amount_paid)}`] : null,
  ].filter(Boolean);

  doc.font('Helvetica').fontSize(9.5).fillColor('#222222');
  for (const [label, value] of rows) {
    doc.text(label, x, y, { width: width - 90 });
    doc.text(value, x + width - 90, y, { width: 90, align: 'right' });
    y += 16;
  }

  doc.moveTo(x, y).lineTo(x + width, y).strokeColor(BORDER).stroke();
  y += 6;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY);
  doc.text('Amount due', x, y, { width: width - 90 });
  doc.text(money(settings, invoice.amount_due), x + width - 90, y, { width: 90, align: 'right' });
  y += 20;

  return y;
}

// Generates a draft preview or issued invoice PDF. `invoice` and `items`
// use the DB row shape (snake_case) — this function is called directly
// from route handlers with fresh rows, not through the camelCase toXxx()
// API-response mappers.
export async function generateInvoicePdfBuffer(invoice, items, settings, { isDraft = false } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, compress: false });
  const bufferPromise = streamToBuffer(doc);

  if (isDraft) drawDraftWatermark(doc);

  drawWordmark(doc, PAGE_MARGIN, PAGE_MARGIN);
  drawBusinessBlock(doc, settings, doc.page.width - PAGE_MARGIN - 220, PAGE_MARGIN, 220);

  let y = PAGE_MARGIN + 70;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY);
  doc.text(isDraft ? 'INVOICE (DRAFT)' : 'INVOICE', PAGE_MARGIN, y);
  y += 26;
  doc.font('Helvetica').fontSize(10).fillColor(GREY);
  doc.text(isDraft ? 'No formal number until issued' : `Invoice ${invoice.invoice_number}`, PAGE_MARGIN, y);
  y += 30;

  const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 20) / 2;
  const billToX = PAGE_MARGIN;
  const detailsX = PAGE_MARGIN + colWidth + 20;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Bill to', billToX, y);
  doc.font('Helvetica').fontSize(9.5).fillColor('#222222').text(
    [invoice.customer_name, invoice.customer_address, invoice.customer_postcode, invoice.customer_email, invoice.customer_phone]
      .filter(Boolean).join('\n'),
    billToX, y + 14, { width: colWidth },
  );

  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Details', detailsX, y);
  const detailLines = [
    ['Issue date', formatDate(invoice.issue_date)],
    ['Due date', formatDate(invoice.due_date)],
    invoice.service_date ? ['Service date', formatDate(invoice.service_date)] : null,
    invoice.booking_ref_snapshot ? ['Booking ref', invoice.booking_ref_snapshot] : null,
    invoice.po_reference ? ['PO reference', invoice.po_reference] : null,
  ].filter(Boolean);
  let detailY = y + 14;
  doc.font('Helvetica').fontSize(9.5).fillColor('#222222');
  for (const [label, value] of detailLines) {
    doc.text(`${label}: ${value}`, detailsX, detailY, { width: colWidth });
    detailY += 14;
  }

  y = Math.max(y + 14 + doc.heightOfString('x', { width: colWidth }) * 5, detailY) + 20;

  y = drawServiceAddressBlock(doc, invoice, billToX, y, colWidth);

  y = drawItemsTable(doc, items, settings, y);
  y = drawTotalsBlock(doc, invoice, settings, y + 10);

  if (invoice.payment_terms || invoice.customer_notes) {
    y += 10;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Payment terms & notes', PAGE_MARGIN, y);
    y += 14;
    doc.font('Helvetica').fontSize(9).fillColor('#222222');
    if (invoice.payment_terms) { doc.text(invoice.payment_terms, PAGE_MARGIN, y, { width: doc.page.width - PAGE_MARGIN * 2 }); y += 14; }
    if (invoice.customer_notes) { doc.text(invoice.customer_notes, PAGE_MARGIN, y, { width: doc.page.width - PAGE_MARGIN * 2 }); }
  }

  y = drawPaymentInstructionsBlock(doc, invoice, settings, y);

  addFooter(doc, settings);
  doc.end();
  return bufferPromise;
}

// Generates a receipt PDF — always a final, immutable document (there is
// no receipt draft state).
export async function generateReceiptPdfBuffer(receipt, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, compress: false });
  const bufferPromise = streamToBuffer(doc);

  drawWordmark(doc, PAGE_MARGIN, PAGE_MARGIN);
  drawBusinessBlock(doc, settings, doc.page.width - PAGE_MARGIN - 220, PAGE_MARGIN, 220);

  let y = PAGE_MARGIN + 70;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text('RECEIPT', PAGE_MARGIN, y);
  y += 26;
  doc.font('Helvetica').fontSize(10).fillColor(GREY).text(`Receipt ${receipt.receipt_number}`, PAGE_MARGIN, y);
  y += 30;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Paid by', PAGE_MARGIN, y);
  doc.font('Helvetica').fontSize(9.5).fillColor('#222222').text(
    [receipt.customer_name, receipt.customer_address, receipt.customer_postcode, receipt.customer_email, receipt.customer_phone]
      .filter(Boolean).join('\n'),
    PAGE_MARGIN, y + 14, { width: 260 },
  );
  y += 90;

  const rows = [
    ['Invoice reference', receipt.invoice_id ? `Invoice ${receipt.invoice_number_snapshot || ''}`.trim() : '—'],
    ['Invoice total', money(settings, receipt.invoice_total)],
    ['Amount received', money(settings, receipt.total_paid)],
    ['Payment date', formatDate(receipt.payment_date)],
    ['Payment method', receipt.payment_method || '—'],
    receipt.payment_reference ? ['Payment reference', receipt.payment_reference] : null,
  ].filter(Boolean);

  doc.font('Helvetica').fontSize(10).fillColor('#222222');
  for (const [label, value] of rows) {
    doc.font('Helvetica-Bold').text(`${label}: `, PAGE_MARGIN, y, { continued: true });
    doc.font('Helvetica').text(String(value));
    y += 18;
  }

  y += 20;
  doc.rect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, 40).fillAndStroke('#eef7ee', '#8fc98f');
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1e6b1e').text(
    'PAID IN FULL — zero balance remaining',
    PAGE_MARGIN, y + 13, { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' },
  );

  addFooter(doc, settings);
  doc.end();
  return bufferPromise;
}
