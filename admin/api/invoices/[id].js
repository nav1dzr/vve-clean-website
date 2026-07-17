import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { readJsonBody } from '../_lib/body.js';
import { extractIdParam } from '../_lib/routeParams.js';
import { isValidUuid, isValidEmail } from '../_lib/normalise.js';
import {
  toInvoiceDetail, toInvoiceItem, toInvoicePayment, toInvoiceEvent,
} from '../_lib/invoiceFields.js';
import {
  updateDraftInvoice, deleteDraftInvoice, issueInvoice, voidInvoice,
  duplicateInvoiceAsDraft, recordPayment, reversePayment,
} from '../_lib/invoiceLifecycle.js';
import { createReceiptIfPaid, loadReceiptPdfExtras } from '../_lib/receiptLifecycle.js';
import { generateInvoicePdfBuffer, generateReceiptPdfBuffer } from '../_lib/invoicePdf.js';
import {
  invoicePdfPath, receiptPdfPath, uploadPdf, getSignedDownloadUrl, downloadPdfBuffer,
} from '../_lib/invoiceStorage.js';
import { getBusinessSettings } from '../_lib/businessSettings.js';
import { invoiceEmail } from '../_lib/invoiceEmailTemplates.js';
import { sendMail, isMailerConfigured } from '../_lib/mailer.js';

export const config = { api: { bodyParser: false } };

// Both factories return a closure matching the `generateAndStorePdf`
// dependency the lifecycle functions expect (see invoiceLifecycle.js's
// issueInvoice and receiptLifecycle.js's createReceiptIfPaid) — this is
// where the "real" PDF renderer + storage upload get wired in, keeping
// those lifecycle modules themselves free of any pdfkit/Storage import.
function makeInvoicePdfGenerator(supabase) {
  return async function generateAndStoreInvoicePdf(invoice, items) {
    // Note: a failure anywhere in here is caught and swallowed by
    // issueInvoice()'s own try/catch (invoiceLifecycle.js) — the invoice is
    // still validly issued either way, so this can never be the cause of
    // POST /api/invoices/:id?action=issue itself returning a non-2xx
    // response. Logged here purely so a failure is still visible server-side.
    const buffer = await generateInvoicePdfBuffer(invoice, items, getBusinessSettings(), { isDraft: false });
    console.log('[invoices route debug] issue: PDF generated for storage, byteLength=%s', buffer.length);
    const result = await uploadPdf(supabase, invoicePdfPath(invoice.id, invoice.document_version || 1), buffer);
    console.log('[invoices route debug] issue: storage upload ok=%s', result?.ok);
    return result;
  };
}

function makeReceiptPdfGenerator(supabase) {
  return async function generateAndStoreReceiptPdf(receipt) {
    const extras = await loadReceiptPdfExtras(supabase, receipt.invoice_id);
    const buffer = await generateReceiptPdfBuffer({ ...receipt, ...extras }, getBusinessSettings());
    return uploadPdf(supabase, receiptPdfPath(receipt.id, receipt.document_version || 1), buffer);
  };
}

// This file is a single, ordinary dynamic segment — `[id].js`, no ellipsis
// — the exact same shape as the already-proven admin/api/bookings/[id].js.
// Actions are dispatched via a `?action=` QUERY STRING parameter, never an
// additional path segment.
//
// Why: this project's Vercel deployment does not interpret `[...x]`/
// `[[...x]]` bracket catch-all syntax as catch-all at all — it parses the
// entire bracket interior (dots included) as the literal name of an
// ordinary, exactly-one-segment dynamic parameter. Confirmed two ways: (1)
// req.query came back with a literal key `'...segments'` (a plain string,
// never the array a real catch-all always produces, even for one segment),
// and (2) a real deployed request to a *two*-segment path
// (/api/invoices/:id/preview) returned a genuine platform 404 — logged
// nowhere, meaning Vercel's own router rejected it before this file's code
// ever ran — while the *one*-segment path (/api/invoices/:id) matched fine.
// Three consecutive routing shapes were tried and broke in exactly this
// pattern (nested optional catch-all → flat optional catch-all → flat
// required catch-all) because each still relied on catch-all semantics
// that this deployment doesn't honour. A query-string action parameter
// sidesteps the question entirely: query strings are never involved in
// Vercel's file-system path matching, so this cannot recur for any future
// action added here. See admin/INVOICES_SETUP.md for the full history.
//
// Actions implemented (all as ?action=<name>, alongside the plain
// GET/PATCH/DELETE with no action for detail/update/delete): issue, void,
// duplicate, payments (record), paymentsReverse (+ &paymentId=), events,
// preview (draft PDF, generated on demand, never stored), download (issued
// invoice — short-lived signed URL to the stored PDF, generating it on the
// fly first if a pre-existing invoice somehow doesn't have one yet), send
// and resend (email the stored PDF — only ever marked sent after the mail
// provider accepts the message).
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  const invoiceId = extractIdParam(req);
  const params = new URL(req.url, 'https://x').searchParams;
  const action = params.get('action') || '';
  // TEMP DEBUG — remove once preview/issue navigation is confirmed stable
  // in production. Deliberately excludes any customer name/email/phone/
  // address; only structural request shape and ids.
  console.log(
    '[invoices route debug] url=%s method=%s query=%o invoiceId=%s action=%s',
    req.url, req.method, req.query, invoiceId, action || '(none)',
  );

  if (!isValidUuid(invoiceId)) {
    console.log('[invoices route debug] rejected: not a valid UUID:', invoiceId);
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid invoice id' }));
  }

  try {
    if (!action) {
      console.log('[invoices route debug] dispatch=root id=%s', invoiceId);
      return await handleRoot(req, res, headers, supabase, invoiceId, auth);
    }
    if (action === 'issue') {
      console.log('[invoices route debug] dispatch=issue id=%s', invoiceId);
      return await handleIssue(req, res, headers, supabase, invoiceId, auth);
    }
    if (action === 'void') return await handleVoid(req, res, headers, supabase, invoiceId, auth);
    if (action === 'duplicate') return await handleDuplicate(req, res, headers, supabase, invoiceId, auth);
    if (action === 'payments') return await handleRecordPayment(req, res, headers, supabase, invoiceId, auth);
    if (action === 'paymentsReverse') {
      const paymentId = params.get('paymentId') || '';
      return await handleReversePayment(req, res, headers, supabase, paymentId, auth);
    }
    if (action === 'events') return await handleEvents(req, res, headers, supabase, invoiceId);
    if (action === 'preview') {
      console.log('[invoices route debug] dispatch=preview id=%s method=%s', invoiceId, req.method);
      return await handlePreview(req, res, headers, supabase, invoiceId);
    }
    if (action === 'download') return await handleDownload(req, res, headers, supabase, invoiceId);
    if (action === 'send') return await handleSend(req, res, headers, supabase, invoiceId, auth, 'sent');
    if (action === 'resend') return await handleSend(req, res, headers, supabase, invoiceId, auth, 'resent');

    console.log('[invoices route debug] dispatch=none (unknown action)', action);
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    // TEMP DEBUG — name/stack included (never request/customer data) to
    // pin down failures that only manifest under real deployed conditions
    // and never reproduce against the in-memory fake Supabase test client.
    console.error(
      '[admin/api] invoice route unexpected error: name=%s message=%s stack=%s',
      err?.name, err?.message, String(err?.stack || '').slice(0, 500),
    );
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleRoot(req, res, headers, supabase, invoiceId, auth) {
  if (req.method === 'GET') {
    const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (error) {
      console.error('[invoices route debug] GET detail supabase error code=%s message=%s', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load invoice' }));
    }
    if (!invoice) {
      console.log('[invoices route debug] GET detail: no row found for id=%s', invoiceId);
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Invoice not found' }));
    }

    const { data: items } = await supabase
      .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order', { ascending: true });
    const { data: payments } = await supabase
      .from('invoice_payments').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false });

    res.writeHead(200, headers);
    return res.end(JSON.stringify({
      ...toInvoiceDetail(invoice),
      items: (items || []).map(toInvoiceItem),
      payments: (payments || []).map(toInvoicePayment),
    }));
  }

  if (req.method === 'PATCH') {
    let body;
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch (err) {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
    }
    const result = await updateDraftInvoice(supabase, invoiceId, body, auth.admin.id);
    if (!result.ok) {
      res.writeHead(result.status || 400, headers);
      return res.end(JSON.stringify({ error: result.error }));
    }
    res.writeHead(200, headers);
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'DELETE') {
    const result = await deleteDraftInvoice(supabase, invoiceId);
    if (!result.ok) {
      res.writeHead(result.status || 400, headers);
      return res.end(JSON.stringify({ error: result.error }));
    }
    res.writeHead(204, headers);
    return res.end();
  }

  res.writeHead(405, headers);
  return res.end(JSON.stringify({ error: 'Method not allowed' }));
}

async function handleIssue(req, res, headers, supabase, invoiceId, auth) {
  if (req.method !== 'POST') {
    console.log('[invoices route debug] issue: method not allowed, got %s', req.method);
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  console.log('[invoices route debug] issue: calling issueInvoice() for id=%s', invoiceId);
  const result = await issueInvoice(supabase, invoiceId, auth.admin.id, { generateAndStorePdf: makeInvoicePdfGenerator(supabase) });
  console.log('[invoices route debug] issue: issueInvoice() returned ok=%s status=%s', result.ok, result.status);
  if (!result.ok) {
    console.log('[invoices route debug] issue failed for id=%s: %s', invoiceId, result.error);
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true, invoiceNumber: result.invoiceNumber }));
}

async function handleVoid(req, res, headers, supabase, invoiceId, auth) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }
  const result = await voidInvoice(supabase, invoiceId, body.reason, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true }));
}

async function handleDuplicate(req, res, headers, supabase, invoiceId, auth) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const result = await duplicateInvoiceAsDraft(supabase, invoiceId, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }
  res.writeHead(201, headers);
  return res.end(JSON.stringify({ ok: true, invoiceId: result.invoiceId }));
}

async function handleRecordPayment(req, res, headers, supabase, invoiceId, auth) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }
  const result = await recordPayment(supabase, invoiceId, body, auth.admin.id, {
    createReceiptIfPaid,
    generateAndStoreReceiptPdf: makeReceiptPdfGenerator(supabase),
  });
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }
  res.writeHead(201, headers);
  return res.end(JSON.stringify({
    ok: true,
    paymentId: result.paymentId,
    amountPaid: result.amountPaid,
    amountDue: result.amountDue,
    paymentStatus: result.paymentStatus,
    receiptId: result.receiptId,
  }));
}

async function handleReversePayment(req, res, headers, supabase, paymentId, auth) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  if (!isValidUuid(paymentId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid payment id' }));
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }
  const result = await reversePayment(supabase, paymentId, body.reason, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true }));
}

async function handleEvents(req, res, headers, supabase, invoiceId) {
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data, error } = await supabase
    .from('invoice_events')
    .select('*')
    .eq('document_type', 'invoice')
    .eq('document_id', invoiceId)
    .order('created_at', { ascending: false });
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load invoice history' }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ results: (data || []).map(toInvoiceEvent) }));
}

// GET /api/invoices/:id?action=preview — always generated on demand, never
// stored (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §8). Works for a draft
// (renders with the DRAFT watermark) or an issued invoice (renders
// exactly as issued, without touching pdf_storage_path/document_version —
// this is a preview endpoint, not the immutable stored document).
async function handlePreview(req, res, headers, supabase, invoiceId) {
  if (req.method !== 'GET') {
    console.log('[invoices route debug] preview: method not allowed, got %s', req.method);
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) {
    console.error('[invoices route debug] preview: invoice fetch failed code=%s message=%s', error.code, error.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load invoice' }));
  }
  if (!invoice) {
    console.log('[invoices route debug] preview: no invoice row for id=%s', invoiceId);
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Invoice not found' }));
  }
  // Structural presence check only (booleans, never values) — surfaces
  // whether migration 20260723000000_add_customers_and_payment_options.sql
  // has actually been applied to this database yet, since select('*')
  // silently omits columns that don't exist rather than erroring.
  console.log(
    '[invoices route debug] preview: invoice loaded status=%s has_payment_option_col=%s has_service_contact_col=%s items_expected',
    invoice.document_status, Object.prototype.hasOwnProperty.call(invoice, 'payment_option'),
    Object.prototype.hasOwnProperty.call(invoice, 'service_contact_name'),
  );

  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order', { ascending: true });
  if (itemsErr || !items || items.length === 0) {
    console.log('[invoices route debug] preview: itemsErr=%o itemCount=%s', itemsErr, items?.length);
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Cannot preview an invoice with no line items' }));
  }
  console.log('[invoices route debug] preview: items loaded count=%s', items.length);

  await supabase.from('invoice_events').insert({ document_type: 'invoice', document_id: invoiceId, event_type: 'previewed' });
  console.log('[invoices route debug] preview: previewed event logged, generating PDF now');

  const settings = invoice.document_status === 'issued' && invoice.business_snapshot ? invoice.business_snapshot : getBusinessSettings();

  let buffer;
  try {
    buffer = await generateInvoicePdfBuffer(invoice, items, settings, { isDraft: invoice.document_status === 'draft' });
  } catch (err) {
    // Logged here (before the outer route handler's generic catch) so the
    // specific pdfkit/rendering failure is visible even though the client
    // only ever receives a generic 500 — never leak invoice content here.
    console.error('[invoices route debug] preview: PDF generation threw: name=%s message=%s', err?.name, err?.message);
    throw err;
  }
  console.log('[invoices route debug] preview: PDF generated, byteLength=%s', buffer.length);

  res.writeHead(200, {
    ...headers,
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="invoice-preview-${invoiceId}.pdf"`,
  });
  return res.end(buffer);
}

// GET /api/invoices/:id?action=download — only for an issued invoice's
// exact stored PDF (never regenerated from possibly-changed data — that
// would violate immutability). Returns a short-lived signed URL rather
// than the bytes directly, per the storage design in
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §8. If an older issued invoice
// somehow has no pdf_storage_path yet (e.g. issued before this endpoint
// existed), it is generated once, from its own immutable business_
// snapshot, and stored — never from live/current settings.
async function handleDownload(req, res, headers, supabase, invoiceId) {
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load invoice' }));
  }
  if (!invoice) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Invoice not found' }));
  }
  if (invoice.document_status !== 'issued') {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ error: 'Only an issued invoice has a final PDF to download' }));
  }

  let path = invoice.pdf_storage_path;
  if (!path) {
    const { data: items } = await supabase
      .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order', { ascending: true });
    const buffer = await generateInvoicePdfBuffer(invoice, items || [], invoice.business_snapshot || getBusinessSettings(), { isDraft: false });
    const uploadResult = await uploadPdf(supabase, invoicePdfPath(invoiceId, invoice.document_version || 1), buffer);
    if (!uploadResult.ok) {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: uploadResult.error }));
    }
    path = uploadResult.path;
    await supabase.from('invoices').update({ pdf_storage_path: path }).eq('id', invoiceId);
  }

  const signedResult = await getSignedDownloadUrl(supabase, path);
  if (!signedResult.ok) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: signedResult.error }));
  }

  await supabase.from('invoice_events').insert({ document_type: 'invoice', document_id: invoiceId, event_type: 'downloaded' });

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ url: signedResult.url }));
}

// POST /api/invoices/:id?action=send and ?action=resend — only ever marks
// the invoice sent after the mail provider accepts the message (a failure
// leaves it exactly as it was, still issued, never silently "sent"). The
// recipient can be corrected per-send via body.to without altering the
// invoice's own stored customer_email — see
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §9.
async function handleSend(req, res, headers, supabase, invoiceId, auth, eventType) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  if (body.to !== undefined && !isValidEmail(body.to)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'to must be a valid email address' }));
  }
  if (!isMailerConfigured()) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Email is not configured on this deployment' }));
  }

  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load invoice' }));
  }
  if (!invoice) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Invoice not found' }));
  }
  if (invoice.document_status !== 'issued') {
    res.writeHead(409, headers);
    return res.end(JSON.stringify({ error: 'Only an issued invoice can be emailed' }));
  }

  // Precedence: an explicit per-send override (body.to) always wins; then
  // the invoice's own stored default recipient (invoice_recipient_email —
  // e.g. "always invoice the agency"); then the billing contact's email.
  const recipient = body.to || invoice.invoice_recipient_email || invoice.customer_email;
  if (!recipient || !isValidEmail(recipient)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'No valid recipient email is available for this invoice' }));
  }

  let path = invoice.pdf_storage_path;
  if (!path) {
    const { data: items } = await supabase
      .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order', { ascending: true });
    const buffer = await generateInvoicePdfBuffer(invoice, items || [], invoice.business_snapshot || getBusinessSettings(), { isDraft: false });
    const uploadResult = await uploadPdf(supabase, invoicePdfPath(invoiceId, invoice.document_version || 1), buffer);
    if (!uploadResult.ok) {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: uploadResult.error }));
    }
    path = uploadResult.path;
    await supabase.from('invoices').update({ pdf_storage_path: path }).eq('id', invoiceId);
  }

  const pdfResult = await downloadPdfBuffer(supabase, path);
  if (!pdfResult.ok) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: pdfResult.error }));
  }

  const settings = invoice.business_snapshot || getBusinessSettings();
  const { subject, html, text } = invoiceEmail(invoice, settings, { customMessage: body.message });

  const sendResult = await sendMail({
    to: recipient,
    subject,
    html,
    text,
    fromName: settings.emailFromName,
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdfResult.buffer, contentType: 'application/pdf' }],
  });

  if (!sendResult.ok) {
    await supabase.from('invoice_events').insert({
      document_type: 'invoice', document_id: invoiceId, event_type: 'send_failed', admin_id: auth.admin.id,
      metadata: { to: recipient, error: sendResult.error },
    });
    res.writeHead(502, headers);
    return res.end(JSON.stringify({ error: 'Failed to send the email' }));
  }

  const nowTs = new Date().toISOString();
  await supabase.from('invoices').update({ sent_at: nowTs, updated_at: nowTs }).eq('id', invoiceId);
  await supabase.from('invoice_events').insert({
    document_type: 'invoice', document_id: invoiceId, event_type: eventType, admin_id: auth.admin.id,
    metadata: { to: recipient, messageId: sendResult.messageId },
  });

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true, to: recipient }));
}
