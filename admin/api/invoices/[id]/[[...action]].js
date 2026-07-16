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

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 64 * 1024;

// One dispatcher file handles /api/invoices/:id and every /api/invoices/
// :id/<action...> route, via Vercel's optional catch-all segment — see
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §7 for why (the admin Vercel
// project's function-count budget does not allow one file per action).
//
// Actions implemented so far: detail (GET, no action), update (PATCH),
// delete (DELETE), issue, void, duplicate, payments (record), payments/
// :paymentId/reverse, events. Preview/download/send/resend are added in
// later phases once PDF generation (Phase 5) and email sending (Phase 6)
// exist — this file is extended then, not duplicated.
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
  const result = await issueInvoice(supabase, invoiceId, auth.admin.id);
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
  const result = await recordPayment(supabase, invoiceId, body, auth.admin.id, { createReceiptIfPaid });
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
