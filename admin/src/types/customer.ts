// Mirrors admin/api/_lib/customerFields.js's toCustomerCard/toCustomerDetail
// and admin/api/customers/[[...segments]].js's response shapes.

export const CUSTOMER_TYPE_VALUES = ['individual', 'landlord', 'letting_agent', 'agency', 'business'] as const;
export type CustomerTypeValue = (typeof CUSTOMER_TYPE_VALUES)[number];

export const CUSTOMER_SOURCE_VALUES = ['website', 'phone', 'whatsapp', 'email', 'referral', 'google', 'repeat_customer', 'other'] as const;
export type CustomerSourceValue = (typeof CUSTOMER_SOURCE_VALUES)[number];

export const CUSTOMER_CONTACT_METHOD_VALUES = ['phone', 'email', 'whatsapp'] as const;
export type CustomerContactMethodValue = (typeof CUSTOMER_CONTACT_METHOD_VALUES)[number];

export const CUSTOMER_SORT_VALUES = ['newest', 'oldest', 'name'] as const;
export type CustomerSortValue = (typeof CUSTOMER_SORT_VALUES)[number];

export interface CustomerCard {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  customerType: CustomerTypeValue;
  source: CustomerSourceValue;
  createdAt: string;
}

export interface CustomerDuplicateWarning {
  type: 'email' | 'phone' | 'postcode_name';
  customer: { id: string; name: string; email: string | null; phone: string | null; postcode: string | null };
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  customerType: CustomerTypeValue;
  source: CustomerSourceValue;
  preferredContactMethod: CustomerContactMethodValue | null;
  notes: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Booking/invoice/receipt cards reuse the same shapes as the booking and
// invoice list pages — imported by the pages that render customer history
// rather than redeclared here.
export interface CustomerHistoryResponse extends CustomerDetail {
  bookings: Array<{
    id: string; bookingRef: string | null; fullName: string; service: string | null;
    status: string; paymentStatus: string; balanceStatus: string | null; totalPrice: number | null; createdAt: string;
  }>;
  invoices: Array<{
    id: string; invoiceNumber: string | null; customerName: string; total: number; amountDue: number;
    documentStatus: string; paymentStatus: string; dueDate: string | null; issueDate: string | null; createdAt: string;
  }>;
  receipts: Array<{
    id: string; receiptNumber: string | null; customerName: string; totalPaid: number; paymentDate: string | null; createdAt: string;
  }>;
  outstandingBalance: number;
  totalPaid: number;
}

export interface CustomerListResponse {
  results: CustomerCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export interface CustomerDraftInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postcode?: string | null;
  customerType?: CustomerTypeValue;
  source?: CustomerSourceValue;
  preferredContactMethod?: CustomerContactMethodValue | null;
  notes?: string | null;
}

export interface CustomerCreateResponse extends CustomerDetail {
  duplicateWarnings: CustomerDuplicateWarning[];
}

export interface CustomerUpdateResponse {
  ok: true;
  duplicateWarnings: CustomerDuplicateWarning[];
}

export interface ManualBookingInput {
  service: string;
  serviceDate?: string | null;
  totalPrice?: number | null;
  notes?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postcode?: string | null;
}

export interface ManualBookingResponse {
  ok: true;
  bookingId: string;
  bookingRef: string | null;
}
