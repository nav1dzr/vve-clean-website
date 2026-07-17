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
// so output is deterministic and has no network dependency at render time
// (a Space Grotesk embed was tried during the visual-polish pass and then
// deliberately reverted — kept to Helvetica per preference; the layout/
// spacing/colour changes from that pass stay). All customer-controlled
// text is rendered as literal PDF text via pdfkit's .text() calls, never
// interpreted as markup, so there is no injection surface analogous to the
// HTML-escaping needed in email templates (api/stripe-webhook.js's
// escHtml() pattern) — pdfkit has no concept of "unescaped" text to begin
// with.

import PDFDocument from 'pdfkit';
import { buildPaymentInstructionsSnapshot } from './paymentOptions.js';
import { hasBankDetails } from './businessSettings.js';

const PAGE_MARGIN = 50;
const NAVY = '#020b24';
const GOLD = '#b8960c';
const GOLD_TINT = '#fbf6e8';
const NAVY_TINT = '#eef1f6';
const GREY = '#666666';
const LIGHT_GREY = '#8a8a8a';
const BORDER = '#dddddd';
const TEXT = '#1c1c1c';

// Reserve room for the footer + its rule on every page's page-break math.
const FOOTER_RESERVE = 46;
const SAFE_BOTTOM = 841.89 - PAGE_MARGIN - FOOTER_RESERVE;

// Returns the font names to use for a render. A function (rather than a
// module-level constant) so the rest of the file doesn't care whether the
// active typeface is a built-in standard font or an embedded one — kept as
// the seam it was when Space Grotesk was embedded here, in case that's
// revisited later.
function loadFonts() {
  return { regular: 'Helvetica', medium: 'Helvetica-Bold', bold: 'Helvetica-Bold' };
}

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
  const sign = value < 0 ? '-' : '';
  return `${sign}${settings.currencySymbol || '£'}${Math.abs(value).toFixed(2)}`;
}

// Signed variant for summary-box rows that are always a reduction (deposit/
// payments already received) — renders as "-£30.00", never the U+2212
// MINUS SIGN glyph, which the standard PDF font encoding does not contain
// (that mismatch was the "&£30.00" rendering bug this replaces).
function negativeMoney(settings, amount) {
  return `-${money(settings, Math.abs(Number(amount || 0)))}`;
}

// "bank_transfer" -> "Bank transfer" — cosmetic only, the stored
// invoice_payments.method/receipts.payment_method value (see the migration
// CHECK constraint) is never altered.
function formatPaymentMethod(value) {
  if (!value) return '—';
  const spaced = String(value).replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Adds a new page if `needed` more points won't fit above the footer
// reserve, returning the (possibly reset-to-top) y to draw at. Used before
// every major block so a mid-size document never splits a box or table
// header awkwardly across a page boundary.
function ensureSpace(doc, fonts, y, needed) {
  if (y + needed <= SAFE_BOTTOM) return y;
  doc.addPage();
  return PAGE_MARGIN;
}

function drawWordmark(doc, fonts, x, y) {
  doc.font(fonts.bold).fontSize(22);
  doc.fillColor(NAVY).text('V', x, y, { continued: true, lineBreak: false });
  doc.fillColor(GOLD).text('V', { continued: true, lineBreak: false });
  doc.fillColor(NAVY).text('E', { continued: false, lineBreak: false });
  const wordmarkWidth = doc.widthOfString('VVE');

  const cleanText = 'CLEAN';
  const cleanSpacing = 2.5;
  doc.font(fonts.medium).fontSize(8.5);
  const cleanWidth = cleanText
    .split('')
    .reduce((w, ch) => w + doc.widthOfString(ch) + cleanSpacing, -cleanSpacing);
  const ruleWidth = 14;
  const ruleGap = 6;
  const totalWidth = ruleWidth + ruleGap + cleanWidth + ruleGap + ruleWidth;

  let cx = x + (wordmarkWidth - totalWidth) / 2;
  const cleanY = y + 28;
  const ruleY = cleanY + 4.5;

  doc.strokeColor(GOLD).lineWidth(1).moveTo(cx, ruleY).lineTo(cx + ruleWidth, ruleY).stroke();
  cx += ruleWidth + ruleGap;
  doc.fillColor(NAVY).text(cleanText, cx, cleanY, { characterSpacing: cleanSpacing, lineBreak: false });
  cx += cleanWidth + ruleGap;
  doc.strokeColor(GOLD).lineWidth(1).moveTo(cx, ruleY).lineTo(cx + ruleWidth, ruleY).stroke();

  return Math.max(wordmarkWidth, totalWidth);
}

// Returns the block's rendered height so callers can position content
// below it without guessing — the number of lines varies with which
// business settings are configured (e.g. registeredAddress is often unset
// until an owner fills it in, see businessSettings.js).
function drawBusinessBlock(doc, fonts, settings, x, y, width) {
  doc.font(fonts.regular).fontSize(8.5).fillColor(GREY);
  const lines = [
    settings.tradingName,
    settings.legalName !== settings.tradingName ? settings.legalName : null,
    settings.companyNumber ? `Company No. ${settings.companyNumber}` : null,
    settings.registeredAddress,
    settings.phone,
    settings.email,
    settings.website,
    settings.vatEnabled && settings.vatNumber ? `VAT No. ${settings.vatNumber}` : null,
  ].filter(Boolean).join('\n');
  doc.text(lines, x, y, { width, align: 'right', lineGap: 1.5 });
  return doc.heightOfString(lines, { width, lineGap: 1.5 });
}

const STATUS_BADGES = {
  draft: { label: 'DRAFT', bg: GOLD_TINT, border: GOLD, text: GOLD },
  invoice: { label: 'INVOICE', bg: NAVY_TINT, border: NAVY, text: NAVY },
  receipt: { label: 'RECEIPT', bg: NAVY_TINT, border: NAVY, text: NAVY },
};

// Draws a small pill badge with its right edge at `rightX`. Returns the
// badge height so callers can lay out around it.
function drawStatusBadge(doc, fonts, kind, rightX, y) {
  const cfg = STATUS_BADGES[kind];
  doc.font(fonts.bold).fontSize(9);
  const textWidth = doc.widthOfString(cfg.label, { characterSpacing: 1 });
  const paddingX = 10;
  const width = textWidth + paddingX * 2;
  const height = 20;
  doc.roundedRect(rightX - width, y, width, height, 3).lineWidth(1).fillAndStroke(cfg.bg, cfg.border);
  doc.fillColor(cfg.text).text(cfg.label, rightX - width, y + 6, { width, align: 'center', characterSpacing: 1 });
  return height;
}

function drawDraftWatermark(doc) {
  doc.save();
  doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.font('Helvetica-Bold').fontSize(90).fillColor('#7a1f1f').opacity(0.06);
  doc.text('DRAFT', 0, doc.page.height / 2 - 60, { width: doc.page.width, align: 'center' });
  doc.opacity(1);
  doc.restore();
}

function addFooter(doc, fonts, settings) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const ruleY = doc.page.height - PAGE_MARGIN + 8;
    doc.moveTo(PAGE_MARGIN, ruleY).lineTo(doc.page.width - PAGE_MARGIN, ruleY).lineWidth(0.5).strokeColor(BORDER).stroke();

    const textY = ruleY + 8;
    doc.font(fonts.regular).fontSize(7).fillColor(LIGHT_GREY);
    const details = [
      settings.tradingName,
      settings.companyNumber ? `Company No. ${settings.companyNumber}` : null,
      settings.website,
      settings.phone,
      settings.email,
    ].filter(Boolean).join(' · ');
    // `height` here is load-bearing, not cosmetic: any `.text()` call with
    // a `width` option runs through pdfkit's LineWrapper, which — unless an
    // explicit `height` is given — measures against `page.maxY()` (=
    // page height minus the *document's* bottom margin) and silently calls
    // `addPage()` the moment the given y sits below that line, regardless
    // of `lineBreak`, alignment, or whether the text actually wraps. A
    // footer drawn inside the reserved bottom margin by design (see
    // FOOTER_RESERVE) is always below that line, so every footer call
    // was triggering its own extra blank trailing page — three fragments
    // of one footer landing on three separate pages. Giving each call a
    // small explicit `height` makes LineWrapper bound itself against that
    // instead of the page margin, which is what actually fixes it (caught
    // by hand-rendering a real PDF during this rewrite, not by the test
    // suite — see invoicePdf.test.js's page-count assertion this bug
    // prompted).
    const footerLineHeight = 11;
    doc.text(details, PAGE_MARGIN, textY, { width: doc.page.width - PAGE_MARGIN * 2 - 90, height: footerLineHeight, align: 'left', lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 90, textY, { width: 90, height: footerLineHeight, align: 'right', lineBreak: false });

    if (i === range.count - 1) {
      doc.font(fonts.regular).fontSize(7).fillColor(LIGHT_GREY)
        .text('Thank you for choosing VVE Clean.', PAGE_MARGIN, textY + 11, { width: doc.page.width - PAGE_MARGIN * 2, height: footerLineHeight, lineBreak: false });
    }
  }
}

function drawItemsTable(doc, fonts, items, settings, startY) {
  const tableX = PAGE_MARGIN;
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const cellPad = 8;
  const cols = {
    description: { x: tableX, width: tableWidth * 0.46 },
    qty: { x: tableX + tableWidth * 0.46, width: tableWidth * 0.1 },
    unitPrice: { x: tableX + tableWidth * 0.56, width: tableWidth * 0.16 },
    discount: { x: tableX + tableWidth * 0.72, width: tableWidth * 0.13 },
    total: { x: tableX + tableWidth * 0.85, width: tableWidth * 0.15 },
  };

  let y = startY;
  const headerHeight = 26;

  function drawHeader() {
    doc.rect(tableX, y, tableWidth, headerHeight).fill(NAVY);
    doc.font(fonts.bold).fontSize(9).fillColor('#ffffff');
    const ty = y + 8;
    doc.text('Description', cols.description.x + cellPad, ty, { width: cols.description.width - cellPad });
    doc.text('Qty', cols.qty.x, ty, { width: cols.qty.width - cellPad, align: 'right' });
    doc.text('Unit price', cols.unitPrice.x, ty, { width: cols.unitPrice.width - cellPad, align: 'right' });
    doc.text('Discount', cols.discount.x, ty, { width: cols.discount.width - cellPad, align: 'right' });
    doc.text('Total', cols.total.x, ty, { width: cols.total.width - cellPad, align: 'right' });
    y += headerHeight;
  }

  drawHeader();

  doc.font(fonts.regular).fontSize(9).fillColor(TEXT);
  items.forEach((item, index) => {
    const descHeight = doc.heightOfString(item.description || '', { width: cols.description.width - cellPad });
    const rowHeight = Math.max(descHeight, 12) + 14;

    if (y + rowHeight > SAFE_BOTTOM) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeader();
      doc.font(fonts.regular).fontSize(9).fillColor(TEXT);
    }

    if (index % 2 === 1) {
      doc.rect(tableX, y, tableWidth, rowHeight).fill('#f7f7f9');
      doc.fillColor(TEXT);
    }

    const ty = y + 7;
    doc.text(item.description || '', cols.description.x + cellPad, ty, { width: cols.description.width - cellPad });
    doc.text(String(item.quantity), cols.qty.x, ty, { width: cols.qty.width - cellPad, align: 'right' });
    doc.text(money(settings, item.unit_price ?? item.unitPrice), cols.unitPrice.x, ty, { width: cols.unitPrice.width - cellPad, align: 'right' });
    doc.text(
      (item.line_discount ?? item.lineDiscount) ? money(settings, item.line_discount ?? item.lineDiscount) : '—',
      cols.discount.x, ty, { width: cols.discount.width - cellPad, align: 'right' },
    );
    doc.text(money(settings, item.line_total ?? item.lineTotal), cols.total.x, ty, { width: cols.total.width - cellPad, align: 'right' });
    y += rowHeight;
  });

  doc.moveTo(tableX, y).lineTo(tableX + tableWidth, y).lineWidth(1).strokeColor(NAVY).stroke();
  return y + 14;
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

function drawServiceAddressBlock(doc, fonts, invoice, x, y, width) {
  const hasServiceInfo = invoice.service_contact_name || invoice.service_address
    || invoice.service_contact_email || invoice.service_contact_phone || invoice.service_contact_postcode;
  if (!hasServiceInfo) return y;

  doc.font(fonts.bold).fontSize(9).fillColor(NAVY).text('Service address', x, y);
  const lines = [invoice.service_contact_name, invoice.service_address, invoice.service_contact_postcode, invoice.service_contact_email, invoice.service_contact_phone]
    .filter(Boolean).join('\n');
  doc.font(fonts.regular).fontSize(9.5).fillColor(TEXT).text(lines, x, y + 14, { width, lineGap: 1.5 });
  return y + 14 + doc.heightOfString(lines, { width, lineGap: 1.5 }) + 14;
}

// Rows: label/value pairs shown inside a bordered "card" — used for both
// the financial summary and the payment-details block (requirements 4/5).
// `emphasisRow`, if given, is drawn larger/bolder with a tinted highlight
// strip beneath the divider (used for "Amount Due").
function drawCard(doc, fonts, { x, y, width, title, rows, emphasisRow }) {
  const paddingX = 14;
  let cy = y + 14;

  if (title) {
    doc.font(fonts.bold).fontSize(9.5).fillColor(NAVY).text(title, x + paddingX, cy, { width: width - paddingX * 2 });
    cy += 18;
  }

  const labelWidth = width - paddingX * 2 - 130;
  const valueWidth = 130;
  doc.font(fonts.regular).fontSize(9.5).fillColor(TEXT);
  for (const [label, value, link] of rows) {
    const rowY = cy;
    doc.font(fonts.regular).fillColor(GREY).text(label, x + paddingX, rowY, { width: labelWidth });
    if (link) {
      doc.font(fonts.medium).fillColor('#0a5cd8').text(value, x + width - paddingX - valueWidth, rowY, { width: valueWidth, align: 'right', link, underline: true });
    } else {
      doc.font(fonts.medium).fillColor(TEXT).text(value, x + width - paddingX - valueWidth, rowY, { width: valueWidth, align: 'right' });
    }
    const labelHeight = doc.font(fonts.regular).heightOfString(label, { width: labelWidth });
    const valueHeight = doc.font(fonts.medium).heightOfString(value, { width: valueWidth });
    cy += Math.max(labelHeight, valueHeight, 16);
  }

  if (emphasisRow) {
    cy += 4;
    doc.moveTo(x + paddingX, cy).lineTo(x + width - paddingX, cy).lineWidth(1).strokeColor(BORDER).stroke();
    cy += 8;
    doc.rect(x, cy - 6, width, 32).fill(GOLD_TINT);
    doc.font(fonts.bold).fontSize(12).fillColor(NAVY).text(emphasisRow[0], x + paddingX, cy, { width: width - paddingX * 2 - 110 });
    doc.text(emphasisRow[1], x + width - paddingX - 110, cy, { width: 110, align: 'right' });
    cy += 26;
  }

  cy += 10;
  doc.roundedRect(x, y, width, cy - y, 4).lineWidth(1).strokeColor(BORDER).stroke();
  return cy;
}

// Mirrors drawCard()'s own layout math exactly, so ensureSpace() checks
// use the real height a card will occupy rather than a hand-rolled
// approximation that can drift out of sync with it (a mismatch here is
// what previously let a wrapped row overflow a page's bottom margin and
// trigger pdfkit's silent auto-pagination — see addFooter's lineBreak
// comment for the sibling bug this class of mistake caused).
function estimateCardHeight(doc, fonts, { width, title, rows, emphasisRow }) {
  const paddingX = 14;
  let h = 14;
  if (title) h += 18;
  const labelWidth = width - paddingX * 2 - 130;
  const valueWidth = 130;
  for (const [label, value] of rows) {
    const labelHeight = doc.font(fonts.regular).fontSize(9.5).heightOfString(label, { width: labelWidth });
    const valueHeight = doc.font(fonts.medium).fontSize(9.5).heightOfString(value, { width: valueWidth });
    h += Math.max(labelHeight, valueHeight, 16);
  }
  if (emphasisRow) h += 4 + 8 + 26;
  return h + 10;
}

function buildTotalsRows(settings, invoice) {
  return [
    ['Subtotal', money(settings, invoice.subtotal)],
    invoice.document_discount ? ['Discount', negativeMoney(settings, invoice.document_discount)] : null,
    settings.vatEnabled ? ['VAT', money(settings, invoice.tax_total)] : null,
    ['Total', money(settings, invoice.total)],
    invoice.deposit_applied ? ['Deposit received', negativeMoney(settings, invoice.deposit_applied)] : null,
    invoice.amount_paid ? ['Payments received', negativeMoney(settings, invoice.amount_paid)] : null,
  ].filter(Boolean);
}

function buildPaymentDetailsRows(instructions, invoiceNumber) {
  const rows = [];
  if (instructions.bankDetails) {
    rows.push(['Method', 'Bank transfer']);
    rows.push(['Account name', instructions.bankDetails.accountName]);
    rows.push(['Sort code', instructions.bankDetails.sortCode]);
    rows.push(['Account number', instructions.bankDetails.accountNumber]);
    rows.push(['Reference', invoiceNumber || 'your invoice number once issued']);
    if (instructions.bankDetails.referenceInstructions) {
      rows.push(['Note', instructions.bankDetails.referenceInstructions]);
    }
  }
  if (instructions.stripePaymentLinkUrl) {
    rows.push([instructions.bankDetails ? 'Card' : 'Method', 'Pay securely by Stripe', instructions.stripePaymentLinkUrl]);
  }
  return rows;
}

function drawPaymentDetailsBox(doc, fonts, invoice, settings, startY) {
  const instructions = resolvePaymentInstructions(invoice, settings);
  const rows = buildPaymentDetailsRows(instructions, invoice.invoice_number);
  if (rows.length === 0) return startY;

  const width = doc.page.width - PAGE_MARGIN * 2;
  const estimatedHeight = estimateCardHeight(doc, fonts, { width, title: 'Payment details', rows });
  const y = ensureSpace(doc, fonts, startY, estimatedHeight);

  const bottomY = drawCard(doc, fonts, { x: PAGE_MARGIN, y, width, title: 'Payment details', rows });
  return bottomY + 10;
}

// Generates a draft preview or issued invoice PDF. `invoice` and `items`
// use the DB row shape (snake_case) — this function is called directly
// from route handlers with fresh rows, not through the camelCase toXxx()
// API-response mappers.
export async function generateInvoicePdfBuffer(invoice, items, settings, { isDraft = false } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, compress: false });
  const bufferPromise = streamToBuffer(doc);
  const fonts = loadFonts();

  if (isDraft) drawDraftWatermark(doc);

  drawWordmark(doc, fonts, PAGE_MARGIN, PAGE_MARGIN);
  const businessBlockHeight = drawBusinessBlock(doc, fonts, settings, doc.page.width - PAGE_MARGIN - 220, PAGE_MARGIN, 220);

  let y = Math.max(PAGE_MARGIN + 62, PAGE_MARGIN + businessBlockHeight + 20);
  doc.font(fonts.bold).fontSize(17).fillColor(NAVY);
  doc.text(isDraft ? 'Invoice (draft)' : 'Invoice', PAGE_MARGIN, y);
  drawStatusBadge(doc, fonts, isDraft ? 'draft' : 'invoice', doc.page.width - PAGE_MARGIN, y - 2);
  y += 24;
  doc.font(fonts.regular).fontSize(9.5).fillColor(GREY);
  doc.text(isDraft ? 'No formal number until issued' : `Invoice ${invoice.invoice_number}`, PAGE_MARGIN, y);
  y += 26;

  const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 20) / 2;
  const billToX = PAGE_MARGIN;
  const detailsX = PAGE_MARGIN + colWidth + 20;

  doc.font(fonts.bold).fontSize(9).fillColor(NAVY).text('Bill to', billToX, y);
  const billLines = [invoice.customer_name, invoice.customer_address, invoice.customer_postcode, invoice.customer_email, invoice.customer_phone]
    .filter(Boolean).join('\n');
  doc.font(fonts.regular).fontSize(9.5).fillColor(TEXT).text(billLines, billToX, y + 14, { width: colWidth, lineGap: 1.5 });

  doc.font(fonts.bold).fontSize(9).fillColor(NAVY).text('Details', detailsX, y);
  const detailLines = [
    ['Invoice Number', invoice.invoice_number || 'Not yet issued'],
    invoice.booking_ref_snapshot ? ['Booking Reference', invoice.booking_ref_snapshot] : null,
    ['Issue Date', formatDate(invoice.issue_date)],
    ['Due Date', formatDate(invoice.due_date)],
    invoice.service_date ? ['Service Date', formatDate(invoice.service_date)] : null,
  ].filter(Boolean);
  let detailY = y + 14;
  doc.font(fonts.regular).fontSize(9.5);
  for (const [label, value] of detailLines) {
    doc.fillColor(GREY).text(`${label}: `, detailsX, detailY, { continued: true, width: colWidth });
    doc.fillColor(TEXT).text(value, { width: colWidth });
    detailY += 14;
  }

  const billHeight = doc.heightOfString(billLines, { width: colWidth, lineGap: 1.5 });
  y = Math.max(y + 14 + billHeight, detailY) + 18;

  y = drawServiceAddressBlock(doc, fonts, invoice, billToX, y, colWidth);

  y = drawItemsTable(doc, fonts, items, settings, y);

  const totalsRows = buildTotalsRows(settings, invoice);
  const totalsWidth = 240;
  const totalsEmphasis = ['Amount Due', money(settings, invoice.amount_due)];
  const totalsEstHeight = estimateCardHeight(doc, fonts, { width: totalsWidth, rows: totalsRows, emphasisRow: totalsEmphasis });
  y = ensureSpace(doc, fonts, y, totalsEstHeight);
  const totalsX = doc.page.width - PAGE_MARGIN - totalsWidth;
  const totalsBottom = drawCard(doc, fonts, {
    x: totalsX, y, width: totalsWidth, rows: totalsRows,
    emphasisRow: totalsEmphasis,
  });
  y = totalsBottom + 10;

  if (invoice.payment_terms || invoice.customer_notes) {
    const notesText = [invoice.payment_terms, invoice.customer_notes].filter(Boolean).join('\n');
    const notesHeight = 14 + doc.font(fonts.regular).fontSize(9).heightOfString(notesText, { width: doc.page.width - PAGE_MARGIN * 2 });
    y = ensureSpace(doc, fonts, y, notesHeight + 10);
    doc.font(fonts.bold).fontSize(9).fillColor(NAVY).text('Payment terms & notes', PAGE_MARGIN, y);
    y += 14;
    doc.font(fonts.regular).fontSize(9).fillColor(TEXT).text(notesText, PAGE_MARGIN, y, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 1.5 });
    y += doc.heightOfString(notesText, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 1.5 }) + 14;
  }

  drawPaymentDetailsBox(doc, fonts, invoice, settings, y);

  addFooter(doc, fonts, settings);
  doc.end();
  return bufferPromise;
}

// Generates a receipt PDF — always a final, immutable document (there is
// no receipt draft state). `receipt` uses the DB row shape (snake_case),
// optionally carrying `booking_ref_snapshot` and `deposit_applied` copied
// in from the linked invoice at render time by the caller (receipts have
// no such columns of their own — see receiptLifecycle.js's
// loadReceiptPdfExtras(), which never mutates the receipts table).
export async function generateReceiptPdfBuffer(receipt, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, compress: false });
  const bufferPromise = streamToBuffer(doc);
  const fonts = loadFonts();

  drawWordmark(doc, fonts, PAGE_MARGIN, PAGE_MARGIN);
  const businessBlockHeight = drawBusinessBlock(doc, fonts, settings, doc.page.width - PAGE_MARGIN - 220, PAGE_MARGIN, 220);

  let y = Math.max(PAGE_MARGIN + 62, PAGE_MARGIN + businessBlockHeight + 20);
  doc.font(fonts.bold).fontSize(17).fillColor(NAVY).text('Receipt', PAGE_MARGIN, y);
  drawStatusBadge(doc, fonts, 'receipt', doc.page.width - PAGE_MARGIN, y - 2);
  y += 24;
  doc.font(fonts.regular).fontSize(9.5).fillColor(GREY).text(`Receipt ${receipt.receipt_number}`, PAGE_MARGIN, y);
  y += 30;

  const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 20) / 2;
  const paidByX = PAGE_MARGIN;
  const detailsX = PAGE_MARGIN + colWidth + 20;

  doc.font(fonts.bold).fontSize(9).fillColor(NAVY).text('Paid by', paidByX, y);
  const paidByLines = [receipt.customer_name, receipt.customer_address, receipt.customer_postcode, receipt.customer_email, receipt.customer_phone]
    .filter(Boolean).join('\n');
  doc.font(fonts.regular).fontSize(9.5).fillColor(TEXT).text(paidByLines, paidByX, y + 14, { width: colWidth, lineGap: 1.5 });

  doc.font(fonts.bold).fontSize(9).fillColor(NAVY).text('Details', detailsX, y);
  const detailLines = [
    ['Invoice Number', receipt.invoice_number_snapshot || '—'],
    receipt.booking_ref_snapshot ? ['Booking Reference', receipt.booking_ref_snapshot] : null,
    ['Payment Date', formatDate(receipt.payment_date)],
    ['Payment Method', formatPaymentMethod(receipt.payment_method)],
    receipt.payment_reference ? ['Payment Reference', receipt.payment_reference] : null,
  ].filter(Boolean);
  let detailY = y + 14;
  doc.font(fonts.regular).fontSize(9.5);
  for (const [label, value] of detailLines) {
    doc.fillColor(GREY).text(`${label}: `, detailsX, detailY, { continued: true, width: colWidth });
    doc.fillColor(TEXT).text(value, { width: colWidth });
    detailY += 14;
  }

  const paidByHeight = doc.heightOfString(paidByLines, { width: colWidth, lineGap: 1.5 });
  y = Math.max(y + 14 + paidByHeight, detailY) + 20;

  const depositApplied = Number(receipt.deposit_applied || 0);
  const invoiceTotal = Number(receipt.invoice_total || 0);
  const totalPaid = Number(receipt.total_paid || 0);
  const finalBalance = Math.round((invoiceTotal - depositApplied - totalPaid) * 100) / 100;

  const summaryRows = [
    ['Invoice total', money(settings, invoiceTotal)],
    depositApplied ? ['Deposit', negativeMoney(settings, depositApplied)] : null,
  ].filter(Boolean);

  const width = doc.page.width - PAGE_MARGIN * 2;
  const receiptEmphasis = ['Amount Received', money(settings, totalPaid)];
  const estHeight = estimateCardHeight(doc, fonts, { width, rows: summaryRows, emphasisRow: receiptEmphasis });
  y = ensureSpace(doc, fonts, y, estHeight);
  y = drawCard(doc, fonts, {
    x: PAGE_MARGIN, y, width, rows: summaryRows,
    emphasisRow: receiptEmphasis,
  });
  y += 6;

  doc.font(fonts.regular).fontSize(9).fillColor(GREY)
    .text(`Final balance: ${money(settings, finalBalance)}`, PAGE_MARGIN, y);
  y += 24;

  y = ensureSpace(doc, fonts, y, 40);
  doc.roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, 40, 4).fillAndStroke('#eef7ee', '#8fc98f');
  doc.font(fonts.bold).fontSize(12).fillColor('#1e6b1e').text(
    'PAID IN FULL — zero balance remaining',
    PAGE_MARGIN, y + 13, { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' },
  );

  addFooter(doc, fonts, settings);
  doc.end();
  return bufferPromise;
}
