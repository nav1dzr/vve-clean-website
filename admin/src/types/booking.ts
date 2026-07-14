// Mirrors the JSON shapes returned by admin/api/_lib/bookingFields.js
// (toCard/toDetail) — kept in one place so every page/component agrees on
// what a "booking card" and "booking detail" look like.

export interface BookingCard {
  id: string;
  bookingRef: string | null;
  fullName: string | null;
  phone: string | null;
  postcode: string | null;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  serviceDate: string | null;
  status: string | null;
  paymentStatus: string | null;
  totalPrice: number | null;
  createdAt: string;
}

export interface BookingDetail {
  id: string;
  bookingRef: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  service: string | null;
  quoteConfig: Record<string, unknown> | null;
  preferredDate: string | null;
  preferredTime: string | null;
  serviceDate: string | null;
  notes: string | null;
  totalPrice: number | null;
  depositAmount: number | null;
  balance: number | null;
  paymentStatus: string | null;
  balanceStatus: string | null;
  balancePaidAt: string | null;
  balancePaymentMethod: string | null;
  status: string | null;
  stripe: {
    sessionId: string | null;
    paymentIntentId: string | null;
  };
  attribution: {
    offerCode: string | null;
    discountPercent: number | null;
    standardTotal: number | null;
    discountAmount: number | null;
    finalTotalAfterDiscount: number | null;
    firstSource: string | null;
    lastSource: string | null;
    landingPage: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    gclid: string | null;
  };
  notifications: {
    emailCustomerSent: boolean | null;
    emailBusinessSent: boolean | null;
    telegramSent: boolean | null;
    sheetsSent: boolean | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  today: { count: number; bookings: BookingCard[] };
  upcoming: { count: number; bookings: BookingCard[] };
  recent: { count: number; bookings: BookingCard[] };
  depositsPaid: { count: number };
  outstandingBalances: { count: number; dataAvailable: boolean };
  unscheduledCount: number;
}

export interface SearchResponse {
  results: BookingCard[];
}

export interface BookingListResponse {
  results: BookingCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export const BOOKING_STATUS_VALUES = [
  'new', 'confirmed', 'scheduled', 'in_progress',
  'completed', 'rescheduled', 'cancelled', 'no_show',
] as const;

export const PAYMENT_STATUS_VALUES = ['pending_payment', 'paid'] as const;

export const SORT_VALUES = ['newest', 'oldest', 'service_date', 'highest_value'] as const;
export type SortValue = (typeof SORT_VALUES)[number];
