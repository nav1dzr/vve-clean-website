import { verifyAdminRequest } from '../../_lib/adminAuth.js';
import { corsHeaders } from '../../_lib/cors.js';
import { getServiceClient } from '../../_lib/supabaseAdmin.js';
import { readJsonBody } from '../../_lib/body.js';
import { extractIdAndAction } from '../../_lib/routeParams.js';
import { isValidUuid } from '../../_lib/normalise.js';
import {
  toInvoiceDetail, toInvoiceItem, toInvoicePayment, toInvoiceEvent,
} from '../../_lib/invoiceFields.js';
import {
  updateDraftInvoice, deleteDraftInvoice, issueInvoice, voidInvoice,
  duplicateInvoiceAsDraft, recordPayment, reversePayment,
} from '../../_lib/invoiceLifecycle.js';
import { createReceiptIfPaid } from '../../_lib/receiptLifecycle.js';
import { generateInvoicePdfBuffer, generateReceiptPdfBuffer } from '../../_lib/invoicePdf.js';
import {
  invoicePdfPath, receiptPdfPath, uploadPdf, getSignedDownloadUrl, downloadPdfBuffer,
} from '../../_lib/invoiceStorage.js';
import { getBusinessSettings } from '../../_lib/businessSettings.js';
import { invoiceEmail } from '../../_lib/invoiceEmailTemplates.js';
import { sendMail, isMailerConfigured } from '../../_lib/mailer.js';
import { isValidEmail } from '../../_lib/normalise.js';

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 64 * 1024;

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

// One dispatcher file handles /api/invoices/:id and every /api/invoices/
// :id/<action...> route, via Vercel's optional catch-all segment — see
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §7 for why (the admin Vercel
// project's function-count budget does not allow one file per action).
//
// Actions implemented: detail (GET, no action), update (PATCH), delete
// (DELETE), issue, void, duplicate, payments (record), payments/
// :paymentId/reverse, events, preview (draft PDF, generated on demand,
// never stored), download (issued invoice — short-lived signed URL to the
// stored PDF, generating it on the fly first if a pre-existing invoice
// somehow doesn't have one yet), send and resend (email the stored PDF —
// only ever marked sent after the mail provider accepts the message).
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

  const { id: invoiceId, action } = extractIdAndAction(req);
  if (!isValidUuid(invoiceId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid invoice id' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
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

  const recipient = body.to || invoice.customer_email;
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
