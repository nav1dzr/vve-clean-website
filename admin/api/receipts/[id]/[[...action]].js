import { verifyAdminRequest } from '../../_lib/adminAuth.js';
import { corsHeaders } from '../../_lib/cors.js';
import { getServiceClient } from '../../_lib/supabaseAdmin.js';
import { readJsonBody } from '../../_lib/body.js';
import { extractIdAndAction } from '../../_lib/routeParams.js';
import { isValidUuid, isValidEmail } from '../../_lib/normalise.js';
import { toReceiptDetail, toInvoiceEvent } from '../../_lib/invoiceFields.js';
import { generateReceiptPdfBuffer } from '../../_lib/invoicePdf.js';
import { receiptPdfPath, uploadPdf, getSignedDownloadUrl, downloadPdfBuffer } from '../../_lib/invoiceStorage.js';
import { getBusinessSettings } from '../../_lib/businessSettings.js';
import { receiptEmail } from '../../_lib/invoiceEmailTemplates.js';
import { sendMail, isMailerConfigured } from '../../_lib/mailer.js';

export const config = { api: { bodyParser: false } };

// Same optional-catch-all dispatcher pattern as
// admin/api/invoices/[id]/[[...action]].js (see that file's header
// comment and INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §7). Receipts have no
// draft state, so there is no preview action — only detail, events,
// download, and send/resend.
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

  const { id: receiptId, action } = extractIdAndAction(req);
  if (!isValidUuid(receiptId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid receipt id' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    if (action.length === 0) return await handleDetail(req, res, headers, supabase, receiptId);
    if (action.length === 1 && action[0] === 'events') return await handleEvents(req, res, headers, supabase, receiptId);
    if (action.length === 1 && action[0] === 'download') return await handleDownload(req, res, headers, supabase, receiptId);
    if (action.length === 1 && action[0] === 'send') return await handleSend(req, res, headers, supabase, receiptId, auth, 'sent');
    if (action.length === 1 && action[0] === 'resend') return await handleSend(req, res, headers, supabase, receiptId, auth, 'resent');

    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('[admin/api] receipt route unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleDetail(req, res, headers, supabase, receiptId) {
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data, error } = await supabase.from('receipts').select('*').eq('id', receiptId).maybeSingle();
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load receipt' }));
  }
  if (!data) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Receipt not found' }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify(toReceiptDetail(data)));
}

async function handleEvents(req, res, headers, supabase, receiptId) {
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data, error } = await supabase
    .from('invoice_events')
    .select('*')
    .eq('document_type', 'receipt')
    .eq('document_id', receiptId)
    .order('created_at', { ascending: false });
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load receipt history' }));
  }
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ results: (data || []).map(toInvoiceEvent) }));
}

async function handleDownload(req, res, headers, supabase, receiptId) {
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const { data: receipt, error } = await supabase.from('receipts').select('*').eq('id', receiptId).maybeSingle();
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load receipt' }));
  }
  if (!receipt) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Receipt not found' }));
  }

  let path = receipt.pdf_storage_path;
  if (!path) {
    const buffer = await generateReceiptPdfBuffer(receipt, receipt.business_snapshot || getBusinessSettings());
    const uploadResult = await uploadPdf(supabase, receiptPdfPath(receiptId, receipt.document_version || 1), buffer);
    if (!uploadResult.ok) {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: uploadResult.error }));
    }
    path = uploadResult.path;
    await supabase.from('receipts').update({ pdf_storage_path: path }).eq('id', receiptId);
  }

  const signedResult = await getSignedDownloadUrl(supabase, path);
  if (!signedResult.ok) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: signedResult.error }));
  }

  await supabase.from('invoice_events').insert({ document_type: 'receipt', document_id: receiptId, event_type: 'downloaded' });

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ url: signedResult.url }));
}

async function handleSend(req, res, headers, supabase, receiptId, auth, eventType) {
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

  const { data: receipt, error } = await supabase.from('receipts').select('*').eq('id', receiptId).maybeSingle();
  if (error) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Failed to load receipt' }));
  }
  if (!receipt) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Receipt not found' }));
  }

  const recipient = body.to || receipt.customer_email;
  if (!recipient || !isValidEmail(recipient)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'No valid recipient email is available for this receipt' }));
  }

  let path = receipt.pdf_storage_path;
  if (!path) {
    const buffer = await generateReceiptPdfBuffer(receipt, receipt.business_snapshot || getBusinessSettings());
    const uploadResult = await uploadPdf(supabase, receiptPdfPath(receiptId, receipt.document_version || 1), buffer);
    if (!uploadResult.ok) {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: uploadResult.error }));
    }
    path = uploadResult.path;
    await supabase.from('receipts').update({ pdf_storage_path: path }).eq('id', receiptId);
  }

  const pdfResult = await downloadPdfBuffer(supabase, path);
  if (!pdfResult.ok) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: pdfResult.error }));
  }

  const settings = receipt.business_snapshot || getBusinessSettings();
  const { subject, html, text } = receiptEmail(receipt, settings, { customMessage: body.message });

  const sendResult = await sendMail({
    to: recipient,
    subject,
    html,
    text,
    fromName: settings.emailFromName,
    attachments: [{ filename: `${receipt.receipt_number}.pdf`, content: pdfResult.buffer, contentType: 'application/pdf' }],
  });

  if (!sendResult.ok) {
    await supabase.from('invoice_events').insert({
      document_type: 'receipt', document_id: receiptId, event_type: 'send_failed', admin_id: auth.admin.id,
      metadata: { to: recipient, error: sendResult.error },
    });
    res.writeHead(502, headers);
    return res.end(JSON.stringify({ error: 'Failed to send the email' }));
  }

  await supabase.from('receipts').update({ sent_at: new Date().toISOString() }).eq('id', receiptId);
  await supabase.from('invoice_events').insert({
    document_type: 'receipt', document_id: receiptId, event_type: eventType, admin_id: auth.admin.id,
    metadata: { to: recipient, messageId: sendResult.messageId },
  });

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true, to: recipient }));
}
