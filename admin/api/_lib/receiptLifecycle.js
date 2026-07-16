// Receipt creation logic — deliberately small. Version one only ever
// creates one formal final receipt, automatically, when an invoice's
// balance reaches zero (see recordPayment() in invoiceLifecycle.js, which
// is the only caller of createReceiptIfPaid below). There is no manual
// "create receipt" entry point and no per-partial-payment receipt, per
// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §6.

import { getBusinessSettings } from './businessSettings.js';

function nowIso() {
  return new Date().toISOString();
}

async function logEvent(supabase, { documentId, eventType, adminId, metadata }) {
  const { error } = await supabase.from('invoice_events').insert({
    document_type: 'receipt',
    document_id: documentId,
    event_type: eventType,
    admin_id: adminId || null,
    metadata: metadata || null,
  });
  if (error) {
    console.error('[admin/api] invoice_events (receipt) insert failed:', error.code, error.message);
  }
}

// Called only from invoiceLifecycle.recordPayment() once an invoice's
// payment_status has just become 'paid'. Idempotency: guards against a
// duplicate receipt for the same invoice by checking none already exists
// first — recordPayment only calls this on the specific update that
// transitioned the status to 'paid', but this check makes the function
// itself safe to call more than once regardless.
export async function createReceiptIfPaid(supabase, input, adminId, { generateAndStorePdf } = {}) {
  const { data: existing, error: existingErr } = await supabase
    .from('receipts')
    .select('id')
    .eq('invoice_id', input.invoiceId)
    .maybeSingle();
  if (existingErr) return { ok: false, error: 'Failed to check for an existing receipt' };
  if (existing) return { ok: true, receiptId: existing.id, alreadyExisted: true };

  const { data: numberResult, error: numberErr } = await supabase.rpc('next_document_number', { p_doc_type: 'receipt' });
  if (numberErr || !numberResult) {
    console.error('[admin/api] receipt number allocation failed:', numberErr?.code, numberErr?.message);
    return { ok: false, error: 'Failed to allocate a receipt number' };
  }

  const { data: receiptRow, error: insertErr } = await supabase
    .from('receipts')
    .insert({
      receipt_number: numberResult,
      invoice_id: input.invoiceId,
      invoice_number_snapshot: input.invoiceNumber || null,
      booking_id: input.bookingId || null,
      customer_name: input.customer.name,
      customer_email: input.customer.email || null,
      customer_phone: input.customer.phone || null,
      customer_address: input.customer.address || null,
      customer_postcode: input.customer.postcode || null,
      invoice_total: input.invoiceTotal,
      total_paid: input.totalPaid,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod,
      payment_reference: input.paymentReference || null,
      business_snapshot: getBusinessSettings(),
      created_by_admin_id: adminId,
    })
    .select('id, receipt_number')
    .single();

  if (insertErr) {
    console.error('[admin/api] receipt insert failed:', insertErr.code, insertErr.message);
    return { ok: false, error: 'Failed to create receipt' };
  }

  await logEvent(supabase, {
    documentId: receiptRow.id,
    eventType: 'receipt_created',
    adminId,
    metadata: { receiptNumber: receiptRow.receipt_number, invoiceId: input.invoiceId },
  });
  // Also record on the invoice's own event trail, so an invoice's history
  // shows the receipt that resulted from it without a join.
  const { error: invoiceEventErr } = await supabase.from('invoice_events').insert({
    document_type: 'invoice',
    document_id: input.invoiceId,
    event_type: 'receipt_created',
    admin_id: adminId || null,
    metadata: { receiptId: receiptRow.id, receiptNumber: receiptRow.receipt_number },
  });
  if (invoiceEventErr) {
    console.error('[admin/api] invoice_events (paid invoice → receipt link) insert failed:', invoiceEventErr.code, invoiceEventErr.message);
  }

  // Same injected-dependency pattern as issueInvoice's PDF generation
  // (invoiceLifecycle.js) — keeps this module testable without mocking
  // pdfkit/Supabase Storage, and a PDF failure never blocks the receipt
  // itself from existing.
  if (typeof generateAndStorePdf === 'function') {
    try {
      const pdfResult = await generateAndStorePdf({
        id: receiptRow.id,
        receipt_number: receiptRow.receipt_number,
        invoice_id: input.invoiceId,
        invoice_number_snapshot: input.invoiceNumber || null,
        customer_name: input.customer.name,
        customer_email: input.customer.email || null,
        customer_phone: input.customer.phone || null,
        customer_address: input.customer.address || null,
        customer_postcode: input.customer.postcode || null,
        invoice_total: input.invoiceTotal,
        total_paid: input.totalPaid,
        payment_date: input.paymentDate,
        payment_method: input.paymentMethod,
        payment_reference: input.paymentReference || null,
      });
      if (pdfResult?.ok) {
        await supabase.from('receipts').update({ pdf_storage_path: pdfResult.path }).eq('id', receiptRow.id);
        await logEvent(supabase, { documentId: receiptRow.id, eventType: 'pdf_generated', adminId, metadata: { path: pdfResult.path } });
      }
    } catch (err) {
      console.error('[admin/api] PDF generation after receipt creation failed:', err?.message);
    }
  }

  return { ok: true, receiptId: receiptRow.id, receiptNumber: receiptRow.receipt_number };
}

export async function markReceiptSent(supabase, receiptId) {
  const { error } = await supabase
    .from('receipts')
    .update({ sent_at: nowIso() })
    .eq('id', receiptId);
  if (error) return { ok: false, error: 'Failed to record receipt as sent' };
  return { ok: true };
}
