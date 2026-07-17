import { verifyAdminRequest } from '../_lib/adminAuth.js';
import { corsHeaders } from '../_lib/cors.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { readJsonBody } from '../_lib/body.js';
import { extractSegments } from '../_lib/routeParams.js';
import { isValidUuid, isValidDateString, isValidEmail, sanitiseFreeTextFilter } from '../_lib/normalise.js';
import {
  INVOICE_CARD_SELECT, toInvoiceCard, toInvoiceDetail, toInvoiceItem, toInvoicePayment, toInvoiceEvent,
  INVOICE_DOCUMENT_STATUS_VALUES, INVOICE_PAYMENT_STATUS_VALUES, INVOICE_SORT_VALUES,
} from '../_lib/invoiceFields.js';
import {
  createDraftInvoice, updateDraftInvoice, deleteDraftInvoice, issueInvoice, voidInvoice,
  duplicateInvoiceAsDraft, recordPayment, reversePayment,
} from '../_lib/invoiceLifecycle.js';
import { createReceiptIfPaid } from '../_lib/receiptLifecycle.js';
import { generateInvoicePdfBuffer, generateReceiptPdfBuffer } from '../_lib/invoicePdf.js';
import {
  invoicePdfPath, receiptPdfPath, uploadPdf, getSignedDownloadUrl, downloadPdfBuffer,
} from '../_lib/invoiceStorage.js';
import { getBusinessSettings } from '../_lib/businessSettings.js';
import { invoiceEmail } from '../_lib/invoiceEmailTemplates.js';
import { sendMail, isMailerConfigured } from '../_lib/mailer.js';

export const config = { api: { bodyParser: false } };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_BODY_BYTES = 64 * 1024; // an editor payload with many line items is larger than a typical 8KB request

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Both factories return a closure matching the `generateAndStorePdf`
// dependency the lifecycle functions expect (see invoiceLifecycle.js's
// issueInvoice and receiptLifecycle.js's createReceiptIfPaid) — this is
// where the "real" PDF renderer + storage upload get wired in, keeping
// those lifecycle modules themselves free of any pdfkit/Storage import.
function makeInvoicePdfGenerator(supabase) {
  return async function generateAndStoreInvoicePdf(invoice, items) {
    const buffer = await generateInvoicePdfBuffer(invoice, items, getBusinessSettings(), { isDraft: false });
    return uploadPdf(supabase, invoicePdfPath(invoice.id, invoice.document_version || 1), buffer);
  };
}

function makeReceiptPdfGenerator(supabase) {
  return async function generateAndStoreReceiptPdf(receipt) {
    const buffer = await generateReceiptPdfBuffer(receipt, getBusinessSettings());
    return uploadPdf(supabase, receiptPdfPath(receipt.id, receipt.document_version || 1), buffer);
  };
}

// One dispatcher file handles /api/invoices (list/create) and every
// /api/invoices/:id[/<action...>] route, via Vercel's optional catch-all
// segment at the *resource root* — mirrors admin/api/receipts/
// [[...segments]].js and admin/api/customers/[[...segments]].js exactly
// (see extractSegments()'s header comment in routeParams.js). This
// replaces the previous two-file split (admin/api/invoices/index.js +
// admin/api/invoices/[id]/[[...action]].js), which nested an optional
// catch-all inside a required dynamic [id] folder — the only route in
// this codebase shaped that way, and the prime suspect once real-world
// navigation from the invoice list into an invoice's detail page
// consistently 404'd in a deployed environment despite the list itself
// (a different file) working fine. Folding both into one flat
// single-level catch-all, the same shape already proven by receipts and
// customers, removes that structural difference entirely. Net function
// count is unchanged (still one deployable file for invoices).
//
// Actions implemented: list (GET, no id), create (POST, no id), detail
// (GET, :id, no action), update (PATCH, :id), delete (DELETE, :id), issue,
// void, duplicate, payments (record), payments/:paymentId/reverse, events,
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

  const segments = extractSegments(req, 'segments', 2);

  try {
    if (segments.length === 0) {
      if (req.method === 'GET') return await handleList(req, res, headers, supabase);
      if (req.method === 'POST') return await handleCreate(req, res, headers, supabase, auth);
      res.writeHead(405, headers);
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    const invoiceId = segments[0];
    if (!isValidUuid(invoiceId)) {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ error: 'Invalid invoice id' }));
    }
    const action = segments.slice(1);

    if (action.length === 0) return await handleRoot(req, res, headers, supabase, invoiceId, auth);
    if (action.length === 1 && action[0] === 'issue') return await handleIssue(req, res, headers, supabase, invoiceId, auth);
    if (action.length === 1 && action[0] === 'void') return await handleVoid(req, res, headers, supabase, invoiceId, auth);
    if (action.length === 1 && action[0] === 'duplicate') return await handleDuplicate(req, res, headers, supabase, invoiceId, auth);
    if (action.length === 1 && action[0] === 'payments') return await handleRecordPayment(req, res, headers, supabase, invoiceId, auth);
    if (action.length === 3 && action[0] === 'payments' && action[2] === 'reverse') {
      return await handleReversePayment(req, res, headers, supabase, action[1], auth);
    }
    if (action.length === 1 && action[0] === 'events') return await handleEvents(req, res, headers, supabase, invoiceId);
    if (action.length === 1 && action[0] === 'preview') return await handlePreview(req, res, headers, supabase, invoiceId);
    if (action.length === 1 && action[0] === 'download') return await handleDownload(req, res, headers, supabase, invoiceId);
    if (action.length === 1 && action[0] === 'send') return await handleSend(req, res, headers, supabase, invoiceId, auth, 'sent');
    if (action.length === 1 && action[0] === 'resend') return await handleSend(req, res, headers, supabase, invoiceId, auth, 'resent');

    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('[admin/api] invoice route unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// Mirrors admin/api/bookings/index.js's buildQuery pattern exactly — every
// filter/sort value is validated against a fixed whitelist before this is
// ever called; free-text search is passed through Supabase's parameterised
// .or()/.ilike(), never string-concatenated SQL.
function buildListQuery(supabase, filters) {
  let query = supabase.from('invoices').select(INVOICE_CARD_SELECT, { count: 'exact' });

  if (filters.documentStatus) query = query.eq('document_status', filters.documentStatus);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.dueFrom) query = query.gte('due_date', filters.dueFrom);
  if (filters.dueTo) query = query.lte('due_date', filters.dueTo);
  if (filters.bookingId) query = query.eq('booking_id', filters.bookingId);

  if (filters.q) {
    const escaped = filters.q.replace(/[%,]/g, '');
    query = query.or(
      [
        `invoice_number.ilike.%${escaped}%`,
        `customer_name.ilike.%${escaped}%`,
        `customer_email.ilike.%${escaped}%`,
        `customer_phone.ilike.%${escaped}%`,
        `customer_postcode.ilike.%${escaped}%`,
        `booking_ref_snapshot.ilike.%${escaped}%`,
      ].join(','),
    );
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'due_soonest':
      query = query.order('due_date', { ascending: true, nullsFirst: false });
      break;
    case 'highest_total':
      query = query.order('total', { ascending: false });
      break;
    case 'highest_outstanding':
      query = query.order('amount_due', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  return query;
}

// GET /api/invoices — filtered, sorted, paginated invoice list.
async function handleList(req, res, headers, supabase) {
  const params = new URL(req.url, 'https://x').searchParams;

  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const sort = params.get('sort') || 'newest';
  if (!INVOICE_SORT_VALUES.includes(sort)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `sort must be one of: ${INVOICE_SORT_VALUES.join(', ')}` }));
  }

  const documentStatus = params.get('documentStatus') || null;
  if (documentStatus && !INVOICE_DOCUMENT_STATUS_VALUES.includes(documentStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `documentStatus must be one of: ${INVOICE_DOCUMENT_STATUS_VALUES.join(', ')}` }));
  }

  const paymentStatus = params.get('paymentStatus') || null;
  if (paymentStatus && !INVOICE_PAYMENT_STATUS_VALUES.includes(paymentStatus)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `paymentStatus must be one of: ${INVOICE_PAYMENT_STATUS_VALUES.join(', ')}` }));
  }

  const bookingId = params.get('bookingId') || null;
  if (bookingId && !isValidUuid(bookingId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'bookingId must be a valid UUID' }));
  }

  const rawQ = params.get('q');
  const q = rawQ ? sanitiseFreeTextFilter(rawQ) : null;
  if (rawQ && !q) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'q filter is invalid' }));
  }

  const dueFrom = params.get('dueFrom') || null;
  if (dueFrom && !isValidDateString(dueFrom)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'dueFrom must be YYYY-MM-DD' }));
  }
  const dueTo = params.get('dueTo') || null;
  if (dueTo && !isValidDateString(dueTo)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'dueTo must be YYYY-MM-DD' }));
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await buildListQuery(supabase, {
    documentStatus, paymentStatus, bookingId, q, dueFrom, dueTo, sort,
  }).range(from, to);

  if (error) {
    console.error('[admin/api] invoices list query failed:', error.code, error.message);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load invoices' }));
  }

  const totalCount = count ?? 0;
  const results = (data || []).map(toInvoiceCard);

  res.writeHead(200, headers);
  return res.end(JSON.stringify({
    results, page, pageSize, totalCount, hasMore: from + results.length < totalCount,
  }));
}

// POST /api/invoices — create a draft invoice (manual, or booking-based
// when bookingId is supplied — the booking itself is never modified).
async function handleCreate(req, res, headers, supabase, auth) {
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  if (body.bookingId && !isValidUuid(body.bookingId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'bookingId must be a valid UUID' }));
  }

  const result = await createDraftInvoice(supabase, body, auth.admin.id);
  if (!result.ok) {
    res.writeHead(result.status || 400, headers);
    return res.end(JSON.stringify({ error: result.error }));
  }

  const { data: created, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', result.invoiceId)
    .single();
  if (fetchErr) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Invoice created but failed to load it back' }));
  }

  res.writeHead(201, headers);
  return res.end(JSON.stringify(toInvoiceDetail(created)));
}

async function handleRoot(req, res, headers, supabase, invoiceId, auth) {
  if (req.method === 'GET') {
    const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (error) {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load invoice' }));
    }
    if (!invoice) {
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
      body = await readJsonBody(req, MAX_BODY_BYTES);
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
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const result = await issueInvoice(supabase, invoiceId, auth.admin.id, { generateAndStorePdf: makeInvoicePdfGenerator(supabase) });
  if (!result.ok) {
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

// GET /api/invoices/:id/preview — always generated on demand, never
// stored (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §8). Works for a draft
// (renders with the DRAFT watermark) or an issued invoice (renders
// exactly as issued, without touching pdf_storage_path/document_version —
// this is a preview endpoint, not the immutable stored document).
async function handlePreview(req, res, headers, supabase, invoiceId) {
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
  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order', { ascending: true });
  if (itemsErr || !items || items.length === 0) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Cannot preview an invoice with no line items' }));
  }

  await supabase.from('invoice_events').insert({ document_type: 'invoice', document_id: invoiceId, event_type: 'previewed' });

  const settings = invoice.document_status === 'issued' && invoice.business_snapshot ? invoice.business_snapshot : getBusinessSettings();
  const buffer = await generateInvoicePdfBuffer(invoice, items, settings, { isDraft: invoice.document_status === 'draft' });

  res.writeHead(200, {
    ...headers,
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="invoice-preview-${invoiceId}.pdf"`,
  });
  return res.end(buffer);
}

// GET /api/invoices/:id/download — only for an issued invoice's exact
// stored PDF (never regenerated from possibly-changed data — that would
// violate immutability). Returns a short-lived signed URL rather than the
// bytes directly, per the storage design in
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

// POST /api/invoices/:id/send and /:id/resend — only ever marks the
// invoice sent after the mail provider accepts the message (a failure
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
