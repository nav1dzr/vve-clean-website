// Whitelists and safe field projections for invoices/receipts, mirroring
// admin/api/_lib/bookingFields.js's pattern exactly: every SELECT list is
// an explicit column allowlist (never `select('*')`), and every row is
// mapped through a to*() function before it ever reaches an API response.

export const INVOICE_DOCUMENT_STATUS_VALUES = ['draft', 'issued', 'void', 'cancelled'];
export const INVOICE_PAYMENT_STATUS_VALUES = ['unpaid', 'partially_paid', 'paid'];
export const INVOICE_PAYMENT_METHOD_VALUES = ['bank_transfer', 'card', 'stripe', 'cash', 'other'];
export const INVOICE_SORT_VALUES = ['newest', 'oldest', 'due_soonest', 'highest_total', 'highest_outstanding'];

export const INVOICE_CARD_SELECT = [
  'id', 'invoice_number', 'customer_name', 'total', 'amount_due',
  'document_status', 'payment_status', 'due_date', 'issue_date', 'created_at',
].join(', ');

export const INVOICE_DETAIL_SELECT = [
  'id', 'booking_id', 'invoice_number',
  'customer_name', 'customer_email', 'customer_phone', 'customer_address', 'customer_postcode',
  'po_reference', 'issue_date', 'due_date', 'service_date', 'booking_ref_snapshot',
  'currency', 'subtotal', 'document_discount', 'tax_total', 'total',
  'deposit_applied', 'amount_paid', 'amount_due',
  'customer_notes', 'internal_notes', 'payment_terms',
  'document_status', 'payment_status', 'void_reason',
  'created_by_admin_id', 'issued_by_admin_id',
  'pdf_storage_path', 'document_version', 'business_snapshot', 'duplicated_from_id',
  'payment_option', 'stripe_payment_link_url', 'payment_instructions_snapshot',
  'service_contact_name', 'service_contact_email', 'service_contact_phone', 'service_address', 'service_contact_postcode',
  'invoice_recipient_email', 'receipt_recipient_email', 'billing_customer_id', 'service_customer_id',
  'created_at', 'updated_at', 'issued_at', 'sent_at', 'paid_at', 'void_at',
].join(', ');

export const RECEIPT_CARD_SELECT = [
  'id', 'receipt_number', 'customer_name', 'total_paid', 'payment_date', 'created_at',
].join(', ');

export const RECEIPT_DETAIL_SELECT = [
  'id', 'receipt_number', 'invoice_id', 'booking_id',
  'customer_name', 'customer_email', 'customer_phone', 'customer_address', 'customer_postcode',
  'invoice_number_snapshot', 'invoice_total', 'total_paid', 'payment_date', 'payment_method', 'payment_reference',
  'business_snapshot', 'created_by_admin_id', 'pdf_storage_path', 'document_version',
  'created_at', 'sent_at',
].join(', ');

export function toInvoiceCard(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    total: row.total,
    amountDue: row.amount_due,
    documentStatus: row.document_status,
    paymentStatus: row.payment_status,
    dueDate: row.due_date,
    issueDate: row.issue_date,
    createdAt: row.created_at,
  };
}

export function toInvoiceDetail(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    invoiceNumber: row.invoice_number,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: row.customer_address,
      postcode: row.customer_postcode,
    },
    poReference: row.po_reference,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    serviceDate: row.service_date,
    bookingRefSnapshot: row.booking_ref_snapshot,
    currency: row.currency,
    subtotal: row.subtotal,
    documentDiscount: row.document_discount,
    taxTotal: row.tax_total,
    total: row.total,
    depositApplied: row.deposit_applied,
    amountPaid: row.amount_paid,
    amountDue: row.amount_due,
    customerNotes: row.customer_notes,
    internalNotes: row.internal_notes,
    paymentTerms: row.payment_terms,
    documentStatus: row.document_status,
    paymentStatus: row.payment_status,
    voidReason: row.void_reason,
    createdByAdminId: row.created_by_admin_id,
    issuedByAdminId: row.issued_by_admin_id,
    documentVersion: row.document_version,
    duplicatedFromId: row.duplicated_from_id,
    paymentOption: row.payment_option,
    stripePaymentLinkUrl: row.stripe_payment_link_url,
    serviceContact: (row.service_contact_name || row.service_contact_email || row.service_contact_phone || row.service_address || row.service_contact_postcode)
      ? {
        name: row.service_contact_name,
        email: row.service_contact_email,
        phone: row.service_contact_phone,
        address: row.service_address,
        postcode: row.service_contact_postcode,
      }
      : null,
    invoiceRecipientEmail: row.invoice_recipient_email,
    receiptRecipientEmail: row.receipt_recipient_email,
    billingCustomerId: row.billing_customer_id,
    serviceCustomerId: row.service_customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    issuedAt: row.issued_at,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    voidAt: row.void_at,
    // pdf_storage_path, business_snapshot, and payment_instructions_snapshot
    // are intentionally excluded — the storage path is an internal detail
    // (downloads go through the signed-URL endpoint, never this raw path)
    // and both snapshots are only needed by the PDF/email renderers
    // themselves, not the list/detail JSON API.
  };
}

export function toInvoiceItem(row) {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineDiscount: row.line_discount,
    lineTotal: row.line_total,
    sortOrder: row.sort_order,
  };
}

export function toInvoicePayment(row) {
  return {
    id: row.id,
    amount: row.amount,
    paymentDate: row.payment_date,
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    createdByAdminId: row.created_by_admin_id,
    createdAt: row.created_at,
    reversedAt: row.reversed_at,
    reversedByAdminId: row.reversed_by_admin_id,
    reversalReason: row.reversal_reason,
  };
}

export function toReceiptCard(row) {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    customerName: row.customer_name,
    totalPaid: row.total_paid,
    paymentDate: row.payment_date,
    createdAt: row.created_at,
  };
}

export function toReceiptDetail(row) {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    invoiceId: row.invoice_id,
    bookingId: row.booking_id,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: row.customer_address,
      postcode: row.customer_postcode,
    },
    invoiceNumberSnapshot: row.invoice_number_snapshot,
    invoiceTotal: row.invoice_total,
    totalPaid: row.total_paid,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    createdByAdminId: row.created_by_admin_id,
    documentVersion: row.document_version,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

export function toInvoiceEvent(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    adminId: row.admin_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}
