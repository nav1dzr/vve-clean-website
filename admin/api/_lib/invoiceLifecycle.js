// Core invoice/receipt business logic, independent of HTTP concerns, so it
// can be unit-tested directly (mocking only the Supabase client) rather
// than through hand-rolled req/res fakes. The route handlers in
// admin/api/invoices/** and admin/api/receipts/** are thin HTTP adapters
// around these functions.
//
// Financial mutations use a service-role-only database transaction. The parent
// invoice lock serializes payments, item replacement and issuance. Expected
// updated_at values reject stale edits; operation UUIDs make payment retries safe.
import { randomUUID } from 'node:crypto';

import {
  calculateInvoiceTotals,
  validateNewPaymentAmount,
} from './invoiceCalculations.js';
import { getBusinessSettings, hasBankDetails } from './businessSettings.js';
import { validatePaymentOptionInput, buildPaymentInstructionsSnapshot } from './paymentOptions.js';
import { isValidEmail, isValidUuid, isValidDateString } from './normalise.js';

const MAX_ITEMS_PER_INVOICE = 100;

async function financialMutation(supabase, action, invoiceId, payload, adminId) {
  let response;
  try {
    response = await supabase.rpc('invoice_financial_mutation', {
      p_action: action, p_invoice_id: invoiceId, p_payload: payload, p_admin_id: adminId,
    });
  } catch {
    return { ok: false, status: 503, error: 'The financial update could not be confirmed. Keep this form and retry the same request.' };
  }
  const { data, error } = response;
  if (error) {
    const status = error.code === 'P0002' ? 404
      : ['40001', '23505'].includes(error.code) ? 409
      : error.code === '22023' ? 400 : 503;
    const message = ['P0002', '40001', '22023'].includes(error.code) ? error.message
      : status === 409 ? 'This request conflicts with another saved change. Reload the invoice.'
      : 'The financial update could not be confirmed. Keep this form and retry the same request.';
    console.error('[admin/api] financial transaction failed:', action, error.code);
    return { ok: false, status, error: message };
  }
  if (!data?.invoice) return { ok: false, status: 503, error: 'The financial update could not be confirmed. Retry the same request.' };
  return { ok: true, ...data };
}


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
    .select('id, document_status, updated_at')
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

  const header = {
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
    };

  const itemRows = totalsResult.totals.lineItems.map((item, index) => ({
    invoice_id: invoiceId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_discount: item.lineDiscount || 0,
    line_total: item.lineTotal,
    sort_order: index,
  }));
  const result = await financialMutation(supabase, 'replace_draft', invoiceId, {
    expected_updated_at: input.expectedUpdatedAt ?? existing.updated_at,
    header, items: itemRows,
  }, adminId);
  return result.ok ? { ok: true, updatedAt: result.invoice.updated_at } : result;
}


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
export async function issueInvoice(supabase, invoiceId, adminId, { generateAndStorePdf, expectedUpdatedAt } = {}) {
  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) return { ok: false, error: 'Failed to load invoice' };
  if (!invoice) return { ok: false, status: 404, error: 'Invoice not found' };
  const businessSnapshot = getBusinessSettings();
  const paymentInstructionsSnapshot = buildPaymentInstructionsSnapshot({
    paymentOption: invoice.payment_option || 'bank_transfer', stripePaymentLinkUrl: invoice.stripe_payment_link_url,
    settings: businessSnapshot, hasBankDetails: hasBankDetails(businessSnapshot),
  });
  const result = await financialMutation(supabase, 'issue', invoiceId, {
    expected_updated_at: expectedUpdatedAt ?? invoice.updated_at,
    business_snapshot: businessSnapshot, payment_instructions_snapshot: paymentInstructionsSnapshot,
  }, adminId);
  if (!result.ok) return result;
  // The issued invoice and source superseding are already committed together.
  // A PDF failure does not roll back financial records; download can regenerate it.
  if (typeof generateAndStorePdf === 'function') {
    try {
      const pdfResult = await generateAndStorePdf(result.invoice, result.items);
      if (pdfResult?.ok) {
        await supabase.from('invoices').update({ pdf_storage_path: pdfResult.path })
          .eq('id', invoiceId).eq('document_version', result.invoice.document_version || 1);
        await logEvent(supabase, { documentType: 'invoice', documentId: invoiceId, eventType: 'pdf_generated', adminId, metadata: { path: pdfResult.path } });
      }
    } catch (err) { console.error('[admin/api] PDF generation after issue failed:', err?.message); }
  }
  return { ok: true, invoiceNumber: result.invoice.invoice_number };
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

// "Revise issued invoice" — safe replacement workflow.
//
// Creates a new editable draft copying all content fields from the original.
// Does NOT mark the original as superseded — that only happens when the
// revised draft is successfully issued (see the supersede block inside
// issueInvoice). If the draft is abandoned the original remains fully active.
//
// Eligibility: source must be issued, unpaid (payment_status = 'unpaid'),
// have no associated receipt, and not already superseded.
export async function reviseIssuedInvoice(supabase, originalInvoiceId, adminId) {
  const { data: original, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', originalInvoiceId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load invoice' };
  if (!original) return { ok: false, error: 'Invoice not found', status: 404 };

  if (original.document_status !== 'issued') {
    return { ok: false, error: 'Only an issued invoice can be revised', status: 409 };
  }
  if (original.payment_status !== 'unpaid') {
    return {
      ok: false,
      error: 'This invoice has payment activity and cannot be directly revised. A credit-note or accounting adjustment workflow is required.',
      status: 409,
    };
  }
  if (original.superseded_by_invoice_id) {
    return { ok: false, error: 'This invoice has already been superseded and cannot be revised again', status: 409 };
  }

  // A receipt exists only when payment_status = 'paid', so this is a
  // defensive belt-and-braces check rather than a practical guard —
  // the payment_status check above would already reject any invoice that
  // has generated a receipt through the normal recordPayment flow.
  const { data: receipts, error: receiptsErr } = await supabase
    .from('receipts')
    .select('id')
    .eq('invoice_id', originalInvoiceId);
  if (receiptsErr) return { ok: false, error: 'Failed to check for existing receipts' };
  if (receipts && receipts.length > 0) {
    return {
      ok: false,
      error: 'This invoice has payment activity and cannot be directly revised. A credit-note or accounting adjustment workflow is required.',
      status: 409,
    };
  }

  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('description, quantity, unit_price, line_discount, line_total, sort_order')
    .eq('invoice_id', originalInvoiceId)
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
      // Revision links — NOT copied from original:
      revised_from_invoice_id: originalInvoiceId,
      revision_source_updated_at: original.updated_at,
      revised_from_invoice_number: original.invoice_number,
      revised_from_issue_date: original.issue_date,
      // payment_instructions_snapshot deliberately NOT carried forward —
      // rebuilt fresh from current settings at issue time (same as duplicate).
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[admin/api] invoice revise create failed:', insertErr.code, insertErr.message);
    return { ok: false, error: 'Failed to create revised draft' };
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
    return { ok: false, error: 'Failed to copy invoice line items' };
  }

  await logEvent(supabase, {
    documentType: 'invoice',
    documentId: newInvoice.id,
    eventType: 'revision_created',
    adminId,
    metadata: { revisedFromId: originalInvoiceId, revisedFromNumber: original.invoice_number },
  });

  return { ok: true, invoiceId: newInvoice.id };
}

// Corrects contact/address mistakes on an issued, unpaid invoice without
// changing its commercial content. The invoice number stays the same, while
// document_version advances so the previous PDF remains preserved in
// versioned storage. Services, prices, discounts, deposits, dates and totals
// are deliberately not accepted here; those belong in the revision workflow.
export async function correctIssuedInvoiceDetails(
  supabase,
  invoiceId,
  input,
  adminId,
  { generateAndStorePdf } = {},
) {
  const { data: original, error: fetchErr } = await supabase
    .from('invoices').select('*').eq('id', invoiceId).maybeSingle();

  if (fetchErr) return { ok: false, error: 'Failed to load invoice' };
  if (!original) return { ok: false, error: 'Invoice not found', status: 404 };
  if (original.document_status !== 'issued') {
    return { ok: false, error: 'Only an issued invoice can have its contact details corrected', status: 409 };
  }
  if (original.payment_status !== 'unpaid') {
    return { ok: false, error: 'Contact details cannot be changed after payment activity. Use the delivery email when sending, or use an accounting adjustment for financial changes.', status: 409 };
  }
  if (original.superseded_by_invoice_id) {
    return { ok: false, error: 'A superseded invoice cannot be corrected', status: 409 };
  }

  const customer = input?.customer || {};
  const customerCheck = validateCustomer(customer);
  if (!customerCheck.ok) return { ok: false, error: customerCheck.error };
  if (customer.email && !isValidEmail(customer.email)) {
    return { ok: false, error: 'customer.email must be a valid email address' };
  }

  const serviceContact = input?.serviceContact || {};
  if (serviceContact.email && !isValidEmail(serviceContact.email)) {
    return { ok: false, error: 'serviceContact.email must be a valid email address' };
  }
  if (input?.invoiceRecipientEmail && !isValidEmail(input.invoiceRecipientEmail)) {
    return { ok: false, error: 'invoiceRecipientEmail must be a valid email address' };
  }
  if (input?.receiptRecipientEmail && !isValidEmail(input.receiptRecipientEmail)) {
    return { ok: false, error: 'receiptRecipientEmail must be a valid email address' };
  }

  const contactPatch = {
    customer_name: customer.name.trim(),
    customer_email: customer.email || null,
    customer_phone: customer.phone || null,
    customer_address: customer.address || null,
    customer_postcode: customer.postcode || null,
    service_contact_name: serviceContact.name || null,
    service_contact_email: serviceContact.email || null,
    service_contact_phone: serviceContact.phone || null,
    service_address: serviceContact.address || null,
    service_contact_postcode: serviceContact.postcode || null,
    invoice_recipient_email: input.invoiceRecipientEmail || null,
    receipt_recipient_email: input.receiptRecipientEmail || null,
  };
  const changedFields = Object.keys(contactPatch).filter((key) => (original[key] ?? null) !== contactPatch[key]);
  if (changedFields.length === 0) return { ok: false, error: 'No contact detail changes were made' };

  const nextVersion = Number(original.document_version || 1) + 1;
  const { data: corrected, error: updateErr } = await supabase
    .from('invoices')
    .update({ ...contactPatch, document_version: nextVersion, pdf_storage_path: null, updated_at: nowIso() })
    .eq('id', invoiceId)
    .eq('document_status', 'issued')
    .eq('payment_status', 'unpaid')
    .is('superseded_by_invoice_id', null)
    .select('*')
    .maybeSingle();

  if (updateErr) return { ok: false, error: 'Failed to correct invoice details' };
  if (!corrected) return { ok: false, error: 'Invoice changed while the correction was being saved. Reload and try again.', status: 409 };

  await logEvent(supabase, {
    documentType: 'invoice', documentId: invoiceId, eventType: 'details_corrected', adminId,
    metadata: { version: nextVersion, changedFields },
  });

  if (typeof generateAndStorePdf === 'function') {
    const { data: items, error: itemsErr } = await supabase
      .from('invoice_items')
      .select('description, quantity, unit_price, line_discount, line_total, sort_order')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true });
    if (!itemsErr) {
      try {
        const pdfResult = await generateAndStorePdf(corrected, items || []);
        if (pdfResult?.ok) {
          await supabase.from('invoices')
            .update({ pdf_storage_path: pdfResult.path })
            .eq('id', invoiceId)
            .eq('document_version', nextVersion);
          await logEvent(supabase, {
            documentType: 'invoice', documentId: invoiceId, eventType: 'pdf_generated', adminId,
            metadata: { path: pdfResult.path, version: nextVersion },
          });
        }
      } catch (err) {
        console.error('[admin/api] PDF regeneration after contact correction failed:', err?.message);
      }
    }
  }

  return { ok: true, documentVersion: nextVersion };
}

// Creates a similar draft while leaving the source invoice untouched.
// Commercial corrections use reviseIssuedInvoice; contact-only mistakes use
// correctIssuedInvoiceDetails. duplicated_from_id retains the relationship.
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
// the locked payment ledger inside the database transaction; independent
// requests cannot validate against the same outdated balance.
// When the recalculated balance reaches zero, a receipt is created in the
// same call (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §6) — receipt creation
// itself lives in receiptLifecycle.js and is invoked from here to keep the
// "did this payment complete the invoice" decision in one place.
export async function recordPayment(supabase, invoiceId, input, adminId, { createReceiptIfPaid, generateAndStoreReceiptPdf } = {}) {
  const amountCheck = validateNewPaymentAmount(input.amount, 500000);
  if (!amountCheck.ok) return { ok: false, error: amountCheck.error };
  if (Math.round(input.amount * 100) / 100 !== input.amount) return { ok: false, error: 'Payment amount must use whole pennies' };
  if (!isValidDateString(input.paymentDate)) return { ok: false, error: 'A valid payment date is required' };
  if (!['bank_transfer','card','stripe','cash','other'].includes(input.method)) return { ok: false, error: 'A valid payment method is required' };
  if (input.operationId !== undefined && !isValidUuid(input.operationId)) return { ok: false, error: 'A valid payment operation ID is required' };
  if ((input.reference != null && typeof input.reference !== 'string') || (input.notes != null && typeof input.notes !== 'string')) return { ok: false, error: 'Payment reference and notes must be text' };
  // HTTP callers must provide the stable UUID; the default supports trusted
  // internal callers, each of which is a distinct operation rather than a retry.
  const result = await financialMutation(supabase, 'record_payment', invoiceId, {
    operation_id: input.operationId || randomUUID(), amount: input.amount, payment_date: input.paymentDate,
    method: input.method, reference: input.reference || null, notes: input.notes || null,
  }, adminId);
  if (!result.ok) return result;
  const invoice = result.invoice;
  let receiptId = null;
  if (invoice.payment_status === 'paid' && !result.replayed && typeof createReceiptIfPaid === 'function') {
    const receiptResult = await createReceiptIfPaid(supabase, {
      invoiceId, invoiceNumber: invoice.invoice_number, bookingId: invoice.booking_id,
      customer: { name: invoice.customer_name, email: invoice.customer_email, phone: invoice.customer_phone,
        address: invoice.customer_address, postcode: invoice.customer_postcode },
      invoiceTotal: invoice.total, totalPaid: invoice.amount_paid, paymentDate: input.paymentDate,
      paymentMethod: input.method, paymentReference: input.reference || null,
      recipientEmailOverride: invoice.receipt_recipient_email || null,
    }, adminId, { generateAndStorePdf: generateAndStoreReceiptPdf });
    if (receiptResult?.ok) receiptId = receiptResult.receiptId;
  } else if (result.replayed && invoice.payment_status === 'paid') {
    // Never create or resend a second receipt while replaying an uncertain save.
    const { data } = await supabase.from('receipts').select('id').eq('invoice_id', invoiceId).maybeSingle();
    receiptId = data?.id || null;
  }
  return { ok: true, paymentId: result.paymentId, amountPaid: invoice.amount_paid, amountDue: invoice.amount_due,
    paymentStatus: invoice.payment_status, receiptId, replayed: Boolean(result.replayed) };
}

// Reversal and aggregate recalculation commit together. Repeating the same
// payment ID/reason is safe; a different reason cannot rewrite the audit history.
export async function reversePayment(supabase, paymentId, reason, adminId) {
  if (typeof reason !== 'string' || !reason.trim()) return { ok: false, error: 'a reversal reason is required' };
  const { data: payment, error } = await supabase.from('invoice_payments').select('invoice_id').eq('id', paymentId).maybeSingle();
  if (error) return { ok: false, error: 'Failed to load payment' };
  if (!payment) return { ok: false, status: 404, error: 'Payment not found' };
  const result = await financialMutation(supabase, 'reverse_payment', payment.invoice_id, { payment_id: paymentId, reason: reason.trim() }, adminId);
  return result.ok ? { ok: true } : result;
}
