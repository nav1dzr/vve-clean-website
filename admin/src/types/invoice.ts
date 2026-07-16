// Mirrors the JSON shapes returned by admin/api/_lib/invoiceFields.js
// (toInvoiceCard/toInvoiceDetail/toInvoiceItem/toInvoicePayment/
// toReceiptCard/toReceiptDetail/toInvoiceEvent) — same "one place, every
// page agrees" rationale as types/booking.ts.

export interface InvoiceCard {
  id: string;
  invoiceNumber: string | null;
  customerName: string;
  total: number;
  amountDue: number;
  documentStatus: string;
  paymentStatus: string;
  dueDate: string | null;
  issueDate: string | null;
  createdAt: string;
}

export interface InvoiceCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
}

export interface InvoiceServiceContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
}

export const PAYMENT_OPTION_VALUES = ['bank_transfer', 'stripe_payment_link', 'both'] as const;
export type PaymentOptionValue = (typeof PAYMENT_OPTION_VALUES)[number];

export interface PaymentInstructionsSnapshot {
  paymentOption: PaymentOptionValue;
  bankDetails: { accountName: string; sortCode: string; accountNumber: string; referenceInstructions: string | null } | null;
  stripePaymentLinkUrl: string | null;
}

export interface InvoiceDetail {
  id: string;
  bookingId: string | null;
  invoiceNumber: string | null;
  customer: InvoiceCustomer;
  poReference: string | null;
  issueDate: string | null;
  dueDate: string | null;
  serviceDate: string | null;
  bookingRefSnapshot: string | null;
  currency: string;
  subtotal: number;
  documentDiscount: number;
  taxTotal: number;
  total: number;
  depositApplied: number;
  amountPaid: number;
  amountDue: number;
  customerNotes: string | null;
  internalNotes: string | null;
  paymentTerms: string | null;
  documentStatus: string;
  paymentStatus: string;
  voidReason: string | null;
  createdByAdminId: string | null;
  issuedByAdminId: string | null;
  documentVersion: number;
  duplicatedFromId: string | null;
  paymentOption: PaymentOptionValue;
  stripePaymentLinkUrl: string | null;
  serviceContact: InvoiceServiceContact | null;
  invoiceRecipientEmail: string | null;
  receiptRecipientEmail: string | null;
  billingCustomerId: string | null;
  serviceCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  voidAt: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  sortOrder: number;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference: string | null;
  notes: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversedByAdminId: string | null;
  reversalReason: string | null;
}

export interface InvoiceEvent {
  id: string;
  eventType: string;
  adminId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface InvoiceListResponse {
  results: InvoiceCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export interface InvoiceEventsResponse {
  results: InvoiceEvent[];
}

export interface IssueResponse {
  ok: true;
  invoiceNumber: string;
}

export interface RecordPaymentResponse {
  ok: true;
  paymentId: string;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  receiptId: string | null;
}

export interface DownloadUrlResponse {
  url: string;
}

export interface SendResponse {
  ok: true;
  to: string;
}

export interface DuplicateResponse {
  ok: true;
  invoiceId: string;
}

// Draft create/update payload shape — matches what
// admin/api/_lib/invoiceLifecycle.js's createDraftInvoice/updateDraftInvoice
// expect.
export interface InvoiceDraftItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
}

export interface InvoiceDraftInput {
  bookingId?: string | null;
  customer: InvoiceCustomer;
  items: InvoiceDraftItemInput[];
  poReference?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  serviceDate?: string | null;
  bookingRefSnapshot?: string | null;
  documentDiscount?: number;
  depositApplied?: number;
  customerNotes?: string | null;
  internalNotes?: string | null;
  paymentTerms?: string | null;
  paymentOption?: PaymentOptionValue;
  stripePaymentLinkUrl?: string | null;
  serviceContact?: InvoiceServiceContact | null;
  invoiceRecipientEmail?: string | null;
  receiptRecipientEmail?: string | null;
  billingCustomerId?: string | null;
  serviceCustomerId?: string | null;
}

export const INVOICE_DOCUMENT_STATUS_VALUES = ['draft', 'issued', 'void', 'cancelled'] as const;
export const INVOICE_PAYMENT_STATUS_VALUES = ['unpaid', 'partially_paid', 'paid'] as const;
export const INVOICE_PAYMENT_METHOD_VALUES = ['bank_transfer', 'card', 'stripe', 'cash', 'other'] as const;
export const INVOICE_SORT_VALUES = ['newest', 'oldest', 'due_soonest', 'highest_total', 'highest_outstanding'] as const;
export type InvoiceSortValue = (typeof INVOICE_SORT_VALUES)[number];

// --- Receipts ---

export interface ReceiptCard {
  id: string;
  receiptNumber: string | null;
  customerName: string;
  totalPaid: number;
  paymentDate: string | null;
  createdAt: string;
}

export interface ReceiptDetail {
  id: string;
  receiptNumber: string | null;
  invoiceId: string | null;
  bookingId: string | null;
  customer: InvoiceCustomer;
  invoiceNumberSnapshot: string | null;
  invoiceTotal: number | null;
  totalPaid: number;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdByAdminId: string | null;
  documentVersion: number;
  createdAt: string;
  sentAt: string | null;
}

export interface ReceiptListResponse {
  results: ReceiptCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}
