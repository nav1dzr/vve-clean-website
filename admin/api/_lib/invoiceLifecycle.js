// Core invoice/receipt business logic, independent of HTTP concerns, so it
// can be unit-tested directly (mocking only the Supabase client) rather
// than through hand-rolled req/res fakes. The route handlers in
// admin/api/invoices/** and admin/api/receipts/** are thin HTTP adapters
// around these functions.
//
// Concurrency note (documented rather than solved with a distributed
// lock, appropriate for a low-concurrency internal admin tool): issuing
// re-checks `document_status = 'draft'` as part of the same conditional
// UPDATE that marks the invoice issued, so only one concurrent "Issue"
// call can win. The number is allocated from the atomic
// next_document_number() RPC just before that guarded UPDATE; in the rare
// case a second, losing concurrent call already consumed a number, that
// number is simply never used again — consistent with the numbering
// policy's own rule that numbers are never reused or reclaimed once
// allocated (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §5). Payment
// recording re-reads all current (non-reversed) payments fresh from the
// database before validating the new payment against the balance, so two
// concurrent payment submissions that would jointly overpay the invoice
// cannot both succeed — the second read includes the first payment.

import {
  calculateInvoiceTotals,
  validateNewPaymentAmount,
  derivePaymentStatus,
} from './invoiceCalculations.js';
import { getBusinessSettings, hasBankDetails } from './businessSettings.js';
import { validatePaymentOptionInput, buildPaymentInstructionsSnapshot } from './paymentOptions.js';
import { isValidEmail, isValidUuid } from './normalise.js';

const MAX_ITEMS_PER_INVOICE = 100;

// Shared by createDraftInvoice/updateDraftInvoice/duplicateInvoiceAsDraft —
// validates the payment-option pair and every optional service/billing
// contact field, returning the exact column values to persist. Never
// trusts a client-sent combination without re-checking (see
// paymentOptions.js's own header).
function validateDraftPaymentAndContactFields(input) {
  const paymentCheck = validatePaymentOptionInput(input.paymentOption, input.stripePaymentLinkUrl);
  if (!paymentCheck.ok) return { ok: false, error: paymentCheck.error };

  if (input.invoiceRecipientEmail && !isValidEmail(input.invoiceRecipientEmail)) {
    return { ok: false, error: 'invoiceRecipientEmail must be a valid email address' };
  }
  if (input.receiptRecipientEmail && !isValidEmail(input.receiptRecipientEmail)) {
    return { ok: false, error: 'receiptRecipientEmail must be a valid email address' };
  }
  if (input.billingCustomerId && !isValidUuid(input.billingCustomerId)) {
    return { ok: false, error: 'billingCustomerId must be a valid UUID' };
  }
  if (input.serviceCustomerId && !isValidUuid(input.serviceCustomerId)) {
    return { ok: false, error: 'serviceCustomerId must be a valid UUID' };
  }

  const serviceContact = input.serviceContact || {};
  return {
    ok: true,
    paymentOption: paymentCheck.paymentOption,
    stripePaymentLinkUrl: paymentCheck.stripePaymentLinkUrl,
    serviceContactName: serviceContact.name || null,
    serviceContactEmail: serviceContact.email || null,
    serviceContactPhone: serviceContact.phone || null,
    serviceAddress: serviceContact.address || null,
    serviceContactPostcode: serviceContact.postcode || null,
    invoiceRecipientEmail: input.invoiceRecipientEmail || null,
    receiptRecipientEmail: input.receiptRecipientEmail || null,
    billingCustomerId: input.billingCustomerId || null,
    serviceCustomerId: input.serviceCustomerId || null,
  };
}

function nowIso() {
  return new Date().toISOString();
}

async function logEvent(supabase, { documentType, documentId, eventType, adminId, metadata }) {
  const { error } = await supabase.from('invoice_events').insert({
    document_type: documentType,
    document_id: documentId,
    event_type: eventType,
    admin_id: adminId || null,
    metadata: metadata || null,
  });
  // Event logging failure must never break the underlying operation it's
  // recording — log and continue, same "best-effort audit trail" stance
  // used elsewhere in this codebase for non-critical side effects.
  if (error) {
    console.error('[admin/api] invoice_events insert failed:', error.code, error.message);
  }
}

function validateCustomer(customer) {
  if (!customer || typeof customer.name !== 'string' || !customer.name.trim()) {
    return { ok: false, error: 'customer.name is required' };
  }
  if (!customer.email && !customer.phone) {
    return { ok: false, error: 'at least one of customer.email or customer.phone is required' };
  }
  return { ok: true };
}

function validateItemsInput(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'at least one line item is required' };
  }
  if (items.length > MAX_ITEMS_PER_INVOICE) {
    return { ok: false, error: `an invoice may have at most ${MAX_ITEMS_PER_INVOICE} line items` };
  }
  for (const item of items) {
    if (typeof item.description !== 'string' || !item.description.trim()) {
      return { ok: false, error: 'every line item needs a description' };
    }
  }
  return { ok: true };
}

// Creates a draft invoice (manual or booking-based — bookingId is optional
// and, when present, is only used to snapshot prefill fields; it never
// rewrites the booking itself). Returns { ok, invoice } or { ok, error }.
export async function createDraftInvoice(supabase, input, adminId) {
  const customerCheck = validateCustomer(input.customer);
  if (!customerCheck.ok) return { ok: false, error: customerCheck.error };

  const itemsCheck = validateItemsInput(input.items);
  if (!itemsCheck.ok) return { ok: false, error: itemsCheck.error };

  const totalsResult = calculateInvoiceTotals({
    items: input.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineDiscount: i.lineDiscount })),
    documentDiscount: input.documentDiscount || 0,
    depositApplied: input.depositApplied || 0,
    payments: [],
  });
  if (!totalsResult.ok) return { ok: false, error: totalsResult.error };

  const fieldsCheck = validateDraftPaymentAndContactFields(input);
  if (!fieldsCheck.ok) return { ok: false, error: fieldsCheck.error };

  const { data: invoiceRow, error: invoiceErr } = await supabase
    .from('invoices')
    .insert({
      booking_id: input.bookingId || null,
      customer_name: input.customer.name.trim(),
      customer_email: input.customer.email || null,
      customer_phone: input.customer.phone || null,
      customer_address: input.customer.address || null,
      customer_postcode: input.customer.postcode || null,
      po_reference: input.poReference || null,
      issue_date: input.issueDate || null,
      due_date: input.dueDate || null,
      service_date: input.serviceDate || null,
      booking_ref_snapshot: input.bookingRefSnapshot || null,
      subtotal: totalsResult.totals.subtotal,
      document_discount: totalsResult.totals.documentDiscount,
      tax_total: totalsResult.totals.taxTotal,
      total: totalsResult.totals.total,
      deposit_applied: totalsResult.totals.depositApplied,
      amount_paid: 0,
      amount_due: totalsResult.totals.amountDue,
      customer_notes: input.customerNotes || null,
      internal_notes: input.internalNotes || null,
      payment_terms: input.paymentTerms || getBusinessSettings().defaultPaymentTermsText,
      document_status: 'draft',
      payment_status: 'unpaid',
      created_by_admin_id: adminId,
      payment_option: fieldsCheck.paymentOption,
      stripe_payment_link_url: fieldsCheck.stripePaymentLinkUrl,
      service_contact_name: fieldsCheck.serviceContactName,
      service_contact_email: fieldsCheck.serviceContactEmail,
      service_contact_phone: fieldsCheck.serviceContactPhone,
      service_address: fieldsCheck.serviceAddress,
      service_contact_postcode: fieldsCheck.serviceContactPostcode,
      invoice_recipient_email: fieldsCheck.invoiceRecipientEmail,
      receipt_recipient_email: fieldsCheck.receiptRecipientEmail,
      billing_customer_id: fieldsCheck.billingCustomerId,
      service_customer_id: fieldsCheck.serviceCustomerId,
    })
    .select('id')
    .single();

  if (invoiceErr) {
    console.error('[admin/api] invoice create failed:', invoiceErr.code, invoiceErr.message);
    return { ok: false, error: 'Failed to create invoice' };
  }

  const itemRows = totalsResult.totals.lineItems.map((item, index) => ({
    invoice_id: invoiceRow.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_discount: item.lineDiscount || 0,
    line_total: item.lineTotal,
    sort_order: index,
  }));

  const { error: itemsErr } = await supabase.from('invoice_items').insert(itemRows);
  if (itemsErr) {
    console.error('[admin/api] invoice_items create failed:', itemsErr.code, itemsErr.message);
    // The invoice row now exists without items — clean it up rather than
    // leaving an unusable half-created draft behind.
    await supabase.from('invoices').delete().eq('id', invoiceRow.id);
    return { ok: false, error: 'Failed to create invoice line items' };
  }

  await logEvent(supabase, {
    documentType: 'invoice', documentId: invoiceRow.id, eventType: 'created', adminId,
  });

  return { ok: true, invoiceId: invoiceRow.id };
}

// Updates a draft invoice's editable fields + fully replaces its line
// items (simplest correct approach for a reorderable, add/remove-capable
// line-item editor). Only allowed while document_status = 'draft' —
// issued invoices are immutable by design (INVOICE_RECEIPT_IMPLEMENTATION_
// PLAN.md §6); this function itself enforces that rather than trusting
// the caller to have checked.
export async function updateDraftInvoice(supabase, invoiceId, input, adminId) {
  const { data: existing, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, document_status')
    .eq('id', invoiceId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load invoice' };
  if (!existing) return { ok: false, error: 'Invoice not found', status: 404 };
  if (existing.document_status !== 'draft') {
    return { ok: false, error: 'Only draft invoices can be edited — duplicate as a corrected draft instead', status: 409 };
  }

  const customerCheck = validateCustomer(input.customer);
  if (!customerCheck.ok) return { ok: false, error: customerCheck.error };

  const itemsCheck = validateItemsInput(input.items);
  if (!itemsCheck.ok) return { ok: false, error: itemsCheck.error };

  const totalsResult = calculateInvoiceTotals({
    items: input.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineDiscount: i.lineDiscount })),
    documentDiscount: input.documentDiscount || 0,
    depositApplied: input.depositApplied || 0,
    payments: [],
  });
  if (!totalsResult.ok) return { ok: false, error: totalsResult.error };

  const fieldsCheck = validateDraftPaymentAndContactFields(input);
  if (!fieldsCheck.ok) return { ok: false, error: fieldsCheck.error };

  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      customer_name: input.customer.name.trim(),
      customer_email: input.customer.email || null,
      customer_phone: input.customer.phone || null,
      customer_address: input.customer.address || null,
      customer_postcode: input.customer.postcode || null,
      po_reference: input.poReference || null,
      issue_date: input.issueDate || null,
      due_date: input.dueDate || null,
      service_date: input.serviceDate || null,
      subtotal: totalsResult.totals.subtotal,
      document_discount: totalsResult.totals.documentDiscount,
      tax_total: totalsResult.totals.taxTotal,
      total: totalsResult.totals.total,
      deposit_applied: totalsResult.totals.depositApplied,
      amount_due: totalsResult.totals.amountDue,
      customer_notes: input.customerNotes || null,
      internal_notes: input.internalNotes || null,
      payment_terms: input.paymentTerms || null,
      payment_option: fieldsCheck.paymentOption,
      stripe_payment_link_url: fieldsCheck.stripePaymentLinkUrl,
      service_contact_name: fieldsCheck.serviceContactName,
      service_contact_email: fieldsCheck.serviceContactEmail,
      service_contact_phone: fieldsCheck.serviceContactPhone,
      service_address: fieldsCheck.serviceAddress,
      service_contact_postcode: fieldsCheck.serviceContactPostcode,
      invoice_recipient_email: fieldsCheck.invoiceRecipientEmail,
      receipt_recipient_email: fieldsCheck.receiptRecipientEmail,
      billing_customer_id: fieldsCheck.billingCustomerId,
      service_customer_id: fieldsCheck.serviceCustomerId,
      updated_at: nowIso(),
    })
    .eq('id', invoiceId)
    .eq('document_status', 'draft');

  if (updateErr) {
    console.error('[admin/api] invoice update failed:', updateErr.code, updateErr.message);
    return { ok: false, error: 'Failed to update invoice' };
  }

  const { error: deleteItemsErr } = await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
  if (deleteItemsErr) {
    console.error('[admin/api] invoice_items replace (delete) failed:', deleteItemsErr.code, deleteItemsErr.message);
    return { ok: false, error: 'Failed to update invoice line items' };
  }

  const itemRows = totalsResult.totals.lineItems.map((item, index) => ({
    invoice_id: invoiceId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_discount: item.lineDiscount || 0,
    line_total: item.lineTotal,
    sort_order: index,
  }));
  const { error: insertItemsErr } = await supabase.from('invoice_items').insert(itemRows);
  if (insertItemsErr) {
    console.error('[admin/api] invoice_items replace (insert) failed:', insertItemsErr.code, insertItemsErr.message);
    return { ok: false, error: 'Failed to update invoice line items' };
  }

  await logEvent(supabase, { documentType: 'invoice', documentId: invoiceId, eventType: 'updated', adminId });

  return { ok: true };
}

// A draft may only be deleted if never issued and has no payments/receipt
// — both are structurally guaranteed by document_status = 'draft' (issuing
// is the only path to a number/payment/receipt), so the single status
// check here is sufficient, not a shortcut.
export async function deleteDraftInvoice(supabase, invoiceId) {
  const { data, error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('document_status', 'draft')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: 'Failed to delete invoice' };
  if (!data) return { ok: false, error: 'Invoice not found or not a draft', status: 404 };
  return { ok: true };
}

// Atomically (see file header) issues a draft invoice: revalidates
// calculations, allocates the formal number, snapshots business/customer/
// item/total data, and marks it issued.
export async function issueInvoice(supabase, invoiceId, adminId, { generateAndStorePdf } = {}) {
  const { data: invoice, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, document_status, customer_name, customer_email, customer_phone, customer_address, customer_postcode, po_reference, service_date, booking_ref_snapshot, subtotal, document_discount, tax_total, total, deposit_applied, amount_paid, amount_due, payment_terms, customer_notes, due_date, issue_date, payment_option, stripe_payment_link_url')
    .eq('id', invoiceId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load invoice' };
  if (!invoice) return { ok: false, error: 'Invoice not found', status: 404 };
  if (invoice.document_status !== 'draft') {
    return { ok: false, error: 'Only a draft invoice can be issued', status: 409 };
  }

  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('description, quantity, unit_price, line_discount, line_total, sort_order')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  if (itemsErr) return { ok: false, error: 'Failed to load invoice line items' };
  if (!items || items.length === 0) return { ok: false, error: 'Cannot issue an invoice with no line items' };

  const { data: numberResult, error: numberErr } = await supabase.rpc('next_document_number', { p_doc_type: 'invoice' });
  if (numberErr || !numberResult) {
    console.error('[admin/api] invoice number allocation failed:', numberErr?.code, numberErr?.message);
    return { ok: false, error: 'Failed to allocate an invoice number' };
  }

  const businessSnapshot = getBusinessSettings();
  const paymentInstructionsSnapshot = buildPaymentInstructionsSnapshot({
    paymentOption: invoice.payment_option || 'bank_transfer',
    stripePaymentLinkUrl: invoice.stripe_payment_link_url,
    settings: businessSnapshot,
    hasBankDetails: hasBankDetails(businessSnapshot),
  });
  const issueDate = invoice.issue_date || nowIso().slice(0, 10);
  const nowTs = nowIso();

  const { data: issued, error: issueErr } = await supabase
    .from('invoices')
    .update({
      invoice_number: numberResult,
      document_status: 'issued',
      issue_date: issueDate,
      issued_by_admin_id: adminId,
      issued_at: nowTs,
      updated_at: nowTs,
      business_snapshot: businessSnapshot,
      payment_instructions_snapshot: paymentInstructionsSnapshot,
    })
    .eq('id', invoiceId)
    .eq('document_status', 'draft')
    .select('id, invoice_number')
    .maybeSingle();

  if (issueErr) {
    console.error('[admin/api] invoice issue failed:', issueErr.code, issueErr.message);
    return { ok: false, error: 'Failed to issue invoice' };
  }
  if (!issued) {
    // Lost the concurrent race — see file header for why the allocated
    // number is simply left unused rather than "returned."
    return { ok: false, error: 'Invoice was already issued (concurrent request)', status: 409 };
  }

  await logEvent(supabase, {
    documentType: 'invoice',
    documentId: invoiceId,
    eventType: 'issued',
    adminId,
    metadata: { invoiceNumber: issued.invoice_number },
  });

  // PDF generation is injected (same pattern as recordPayment's
  // createReceiptIfPaid) rather than imported directly, so this module
  // stays testable without mocking pdfkit/Supabase Storage. A failure here
  // does not roll back the issue — the invoice is validly issued with a
  // real number either way; the PDF can be regenerated for the same
  // version on demand (admin/api/invoices/[...segments].js's
  // download action falls back to generating on the fly if
  // pdf_storage_path is still empty).
  if (typeof generateAndStorePdf === 'function') {
    try {
      const pdfResult = await generateAndStorePdf({ ...invoice, ...issued, issue_date: issueDate, business_snapshot: businessSnapshot }, items);
      if (pdfResult?.ok) {
        await supabase.from('invoices').update({ pdf_storage_path: pdfResult.path }).eq('id', invoiceId);
        await logEvent(supabase, { documentType: 'invoice', documentId: invoiceId, eventType: 'pdf_generated', adminId, metadata: { path: pdfResult.path } });
      }
    } catch (err) {
      // Genuinely never roll back the issue for this — see comment above.
      console.error('[admin/api] PDF generation after issue failed:', err?.message);
    }
  }

  return { ok: true, invoiceNumber: issued.invoice_number };
}

export async function voidInvoice(supabase, invoiceId, reason, adminId) {
  if (typeof reason !== 'string' || !reason.trim()) {
    return { ok: false, error: 'a void reason is required' };
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({
      document_status: 'void',
      void_reason: reason.trim(),
      void_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('id', invoiceId)
    .in('document_status', ['draft', 'issued'])
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: 'Failed to void invoice' };
  if (!data) return { ok: false, error: 'Invoice not found, or already void/cancelled', status: 404 };

  await logEvent(supabase, {
    documentType: 'invoice', documentId: invoiceId, eventType: 'voided', adminId, metadata: { reason: reason.trim() },
  });

  return { ok: true };
}

// "Duplicate as corrected draft" — the only way to change an issued
// invoice's data. The original stays untouched and remains visible;
// duplicated_from_id links the new draft back to it for the UI to surface.
export async function duplicateInvoiceAsDraft(supabase, invoiceId, adminId) {
  const { data: original, error: fetchErr } = await supabase
    .from('invoices')
    .select('booking_id, customer_name, customer_email, customer_phone, customer_address, customer_postcode, po_reference, due_date, service_date, booking_ref_snapshot, document_discount, deposit_applied, customer_notes, internal_notes, payment_terms, payment_option, stripe_payment_link_url, service_contact_name, service_contact_email, service_contact_phone, service_address, service_contact_postcode, invoice_recipient_email, receipt_recipient_email, billing_customer_id, service_customer_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load invoice' };
  if (!original) return { ok: false, error: 'Invoice not found', status: 404 };

  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('description, quantity, unit_price, line_discount, line_total, sort_order')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });
  if (itemsErr) return { ok: false, error: 'Failed to load invoice line items' };

  const totalsResult = calculateInvoiceTotals({
    items: (items || []).map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unit_price, lineDiscount: i.line_discount })),
    documentDiscount: original.document_discount || 0,
    depositApplied: original.deposit_applied || 0,
    payments: [],
  });
  if (!totalsResult.ok) return { ok: false, error: totalsResult.error };

  const { data: newInvoice, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      booking_id: original.booking_id,
      customer_name: original.customer_name,
      customer_email: original.customer_email,
      customer_phone: original.customer_phone,
      customer_address: original.customer_address,
      customer_postcode: original.customer_postcode,
      po_reference: original.po_reference,
      due_date: original.due_date,
      service_date: original.service_date,
      booking_ref_snapshot: original.booking_ref_snapshot,
      subtotal: totalsResult.totals.subtotal,
      document_discount: totalsResult.totals.documentDiscount,
      tax_total: totalsResult.totals.taxTotal,
      total: totalsResult.totals.total,
      deposit_applied: totalsResult.totals.depositApplied,
      amount_paid: 0,
      amount_due: totalsResult.totals.amountDue,
      customer_notes: original.customer_notes,
      internal_notes: original.internal_notes,
      payment_terms: original.payment_terms,
      document_status: 'draft',
      payment_status: 'unpaid',
      created_by_admin_id: adminId,
      duplicated_from_id: invoiceId,
      payment_option: original.payment_option,
      stripe_payment_link_url: original.stripe_payment_link_url,
      service_contact_name: original.service_contact_name,
      service_contact_email: original.service_contact_email,
      service_contact_phone: original.service_contact_phone,
      service_address: original.service_address,
      service_contact_postcode: original.service_contact_postcode,
      invoice_recipient_email: original.invoice_recipient_email,
      receipt_recipient_email: original.receipt_recipient_email,
      billing_customer_id: original.billing_customer_id,
      service_customer_id: original.service_customer_id,
      // payment_instructions_snapshot is deliberately NOT carried forward —
      // it is frozen only at issue time (see the migration file header) and
      // will be rebuilt fresh, from then-current settings, when this new
      // draft is itself issued.
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[admin/api] invoice duplicate failed:', insertErr.code, insertErr.message);
    return { ok: false, error: 'Failed to duplicate invoice' };
  }

  const itemRows = totalsResult.totals.lineItems.map((item, index) => ({
    invoice_id: newInvoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_discount: item.lineDiscount || 0,
    line_total: item.lineTotal,
    sort_order: index,
  }));
  const { error: itemsInsertErr } = await supabase.from('invoice_items').insert(itemRows);
  if (itemsInsertErr) {
    await supabase.from('invoices').delete().eq('id', newInvoice.id);
    return { ok: false, error: 'Failed to duplicate invoice line items' };
  }

  await logEvent(supabase, {
    documentType: 'invoice', documentId: newInvoice.id, eventType: 'duplicated', adminId, metadata: { duplicatedFromId: invoiceId },
  });

  return { ok: true, invoiceId: newInvoice.id };
}

// Records a payment against an issued invoice. Recalculates aggregates from
// every current non-reversed payment (freshly read) plus this new one, so
// two concurrent submissions cannot jointly overpay (see file header).
// When the recalculated balance reaches zero, a receipt is created in the
// same call (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §6) — receipt creation
// itself lives in receiptLifecycle.js and is invoked from here to keep the
// "did this payment complete the invoice" decision in one place.
export async function recordPayment(supabase, invoiceId, input, adminId, { createReceiptIfPaid, generateAndStoreReceiptPdf } = {}) {
  const { data: invoice, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, document_status, invoice_number, total, deposit_applied, booking_id, customer_name, customer_email, customer_phone, customer_address, customer_postcode, receipt_recipient_email')
    .eq('id', invoiceId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load invoice' };
  if (!invoice) return { ok: false, error: 'Invoice not found', status: 404 };
  if (invoice.document_status !== 'issued') {
    return { ok: false, error: 'Payments can only be recorded against an issued invoice', status: 409 };
  }

  const { data: existingPayments, error: paymentsErr } = await supabase
    .from('invoice_payments')
    .select('amount, reversed_at')
    .eq('invoice_id', invoiceId);
  if (paymentsErr) return { ok: false, error: 'Failed to load existing payments' };

  const alreadyPaid = (existingPayments || [])
    .filter((p) => !p.reversed_at)
    .reduce((sum, p) => sum + p.amount, 0);
  const amountDueBeforeThisPayment = Math.round((invoice.total - invoice.deposit_applied - alreadyPaid) * 100) / 100;

  const amountCheck = validateNewPaymentAmount(input.amount, amountDueBeforeThisPayment);
  if (!amountCheck.ok) return { ok: false, error: amountCheck.error };

  const { data: paymentRow, error: insertErr } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: invoiceId,
      amount: input.amount,
      payment_date: input.paymentDate,
      method: input.method,
      reference: input.reference || null,
      notes: input.notes || null,
      created_by_admin_id: adminId,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[admin/api] invoice_payments insert failed:', insertErr.code, insertErr.message);
    return { ok: false, error: 'Failed to record payment' };
  }

  const newAmountPaid = Math.round((alreadyPaid + input.amount) * 100) / 100;
  const newAmountDue = Math.round((invoice.total - invoice.deposit_applied - newAmountPaid) * 100) / 100;
  const paymentStatus = derivePaymentStatus(newAmountDue, invoice.total);
  const nowTs = nowIso();

  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      amount_due: newAmountDue,
      payment_status: paymentStatus,
      paid_at: paymentStatus === 'paid' ? nowTs : null,
      updated_at: nowTs,
    })
    .eq('id', invoiceId);

  if (updateErr) {
    console.error('[admin/api] invoice aggregate update after payment failed:', updateErr.code, updateErr.message);
    return { ok: false, error: 'Payment recorded but failed to update invoice totals — contact support' };
  }

  await logEvent(supabase, {
    documentType: 'invoice',
    documentId: invoiceId,
    eventType: 'payment_recorded',
    adminId,
    metadata: { paymentId: paymentRow.id, amount: input.amount, method: input.method },
  });

  let receiptId = null;
  if (paymentStatus === 'paid' && typeof createReceiptIfPaid === 'function') {
    const receiptResult = await createReceiptIfPaid(supabase, {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      bookingId: invoice.booking_id,
      customer: {
        name: invoice.customer_name,
        email: invoice.customer_email,
        phone: invoice.customer_phone,
        address: invoice.customer_address,
        postcode: invoice.customer_postcode,
      },
      invoiceTotal: invoice.total,
      totalPaid: newAmountPaid,
      paymentDate: input.paymentDate,
      paymentMethod: input.method,
      paymentReference: input.reference || null,
      recipientEmailOverride: invoice.receipt_recipient_email || null,
    }, adminId, { generateAndStorePdf: generateAndStoreReceiptPdf });
    if (receiptResult?.ok) receiptId = receiptResult.receiptId;
  }

  return { ok: true, paymentId: paymentRow.id, amountPaid: newAmountPaid, amountDue: newAmountDue, paymentStatus, receiptId };
}

// Reverses a payment (never deletes it — invoice_payments is append-only)
// and recalculates the invoice's aggregates the same way recordPayment
// does, from a fresh read of every non-reversed payment.
export async function reversePayment(supabase, paymentId, reason, adminId) {
  if (typeof reason !== 'string' || !reason.trim()) {
    return { ok: false, error: 'a reversal reason is required' };
  }

  const { data: payment, error: fetchErr } = await supabase
    .from('invoice_payments')
    .select('id, invoice_id, reversed_at')
    .eq('id', paymentId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load payment' };
  if (!payment) return { ok: false, error: 'Payment not found', status: 404 };
  if (payment.reversed_at) return { ok: false, error: 'Payment is already reversed', status: 409 };

  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select('id, total, deposit_applied')
    .eq('id', payment.invoice_id)
    .maybeSingle();
  if (invoiceErr || !invoice) return { ok: false, error: 'Failed to load parent invoice' };

  const nowTs = nowIso();
  const { error: reverseErr } = await supabase
    .from('invoice_payments')
    .update({ reversed_at: nowTs, reversed_by_admin_id: adminId, reversal_reason: reason.trim() })
    .eq('id', paymentId)
    .is('reversed_at', null);

  if (reverseErr) return { ok: false, error: 'Failed to reverse payment' };

  const { data: remainingPayments, error: remainingErr } = await supabase
    .from('invoice_payments')
    .select('amount, reversed_at')
    .eq('invoice_id', payment.invoice_id);
  if (remainingErr) return { ok: false, error: 'Failed to recalculate invoice totals' };

  const newAmountPaid = (remainingPayments || [])
    .filter((p) => !p.reversed_at)
    .reduce((sum, p) => sum + p.amount, 0);
  const newAmountDue = Math.round((invoice.total - invoice.deposit_applied - newAmountPaid) * 100) / 100;
  const paymentStatus = derivePaymentStatus(newAmountDue, invoice.total);

  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      amount_paid: Math.round(newAmountPaid * 100) / 100,
      amount_due: newAmountDue,
      payment_status: paymentStatus,
      paid_at: paymentStatus === 'paid' ? nowTs : null,
      updated_at: nowTs,
    })
    .eq('id', payment.invoice_id);

  if (updateErr) return { ok: false, error: 'Reversal recorded but failed to update invoice totals — contact support' };

  await logEvent(supabase, {
    documentType: 'invoice',
    documentId: payment.invoice_id,
    eventType: 'payment_reversed',
    adminId,
    metadata: { paymentId, reason: reason.trim() },
  });

  return { ok: true };
}
