// Whitelists and safe field projections shared by every Phase 2 booking API
// route. Centralising these means "validate and whitelist every filter and
// sort value" (ADMIN_CRM_PLAN.md Phase 2 spec) only has to be got right once.
//
// IMPORTANT: every SELECT list here is an explicit column allowlist, never
// `select('*')` — this is what guarantees confirmation_token (and any future
// sensitive column someone adds to `bookings`) can never leak through a
// Phase 2 API response even by accident.

export const BOOKING_STATUS_VALUES = [
  'new', 'confirmed', 'scheduled', 'in_progress',
  'completed', 'rescheduled', 'cancelled', 'no_show',
];

// The live system only ever writes these two values (api/create-checkout-
// session.js and api/stripe-webhook.js) — not an exhaustive theoretical
// enum, but the actual set of values that exist in this database.
export const PAYMENT_STATUS_VALUES = ['pending_payment', 'paid'];

export const BALANCE_STATUS_VALUES = ['not_due', 'outstanding', 'paid', 'waived'];

export const SORT_VALUES = ['newest', 'oldest', 'service_date', 'highest_value'];

// Card projection — used by dashboard-summary, search, and the booking list.
// Deliberately excludes address/notes/Stripe IDs/attribution/tokens; those
// are detail-only fields (§19).
export const CARD_SELECT = [
  'id', 'booking_ref', 'full_name', 'phone', 'postcode', 'service',
  'preferred_date', 'preferred_time', 'service_date',
  'status', 'payment_status', 'total_price', 'created_at',
].join(', ');

// Detail projection — every field ADMIN_CRM_PLAN.md §19 calls for, and
// nothing else. confirmation_token is intentionally absent from this list.
export const DETAIL_SELECT = [
  'id', 'booking_ref', 'full_name', 'phone', 'email', 'address', 'postcode',
  'service', 'quote_config', 'preferred_date', 'preferred_time', 'service_date',
  'notes', 'total_price', 'deposit_amount',
  'payment_status', 'balance_status', 'balance_paid_at', 'balance_payment_method',
  'status',
  'stripe_session_id', 'stripe_payment_intent_id',
  'offer_code', 'discount_percent', 'standard_total', 'discount_amount', 'final_total_after_discount',
  'first_source', 'last_source', 'landing_page',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid',
  'email_customer_sent', 'email_business_sent', 'telegram_sent', 'sheets_sent',
  'created_at', 'updated_at',
].join(', ');

export function toCard(row) {
  return {
    id: row.id,
    bookingRef: row.booking_ref,
    fullName: row.full_name,
    phone: row.phone,
    postcode: row.postcode,
    service: row.service,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    serviceDate: row.service_date,
    status: row.status,
    paymentStatus: row.payment_status,
    totalPrice: row.total_price,
    createdAt: row.created_at,
  };
}

export function toDetail(row) {
  const hasBalanceInputs = row.total_price != null && row.deposit_amount != null;

  return {
    id: row.id,
    bookingRef: row.booking_ref,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    postcode: row.postcode,
    service: row.service,
    quoteConfig: row.quote_config,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    serviceDate: row.service_date,
    notes: row.notes,
    totalPrice: row.total_price,
    depositAmount: row.deposit_amount,
    balance: hasBalanceInputs ? row.total_price - row.deposit_amount : null,
    paymentStatus: row.payment_status,
    balanceStatus: row.balance_status,
    balancePaidAt: row.balance_paid_at,
    balancePaymentMethod: row.balance_payment_method,
    status: row.status,
    stripe: {
      sessionId: row.stripe_session_id,
      paymentIntentId: row.stripe_payment_intent_id,
    },
    attribution: {
      offerCode: row.offer_code,
      discountPercent: row.discount_percent,
      standardTotal: row.standard_total,
      discountAmount: row.discount_amount,
      finalTotalAfterDiscount: row.final_total_after_discount,
      firstSource: row.first_source,
      lastSource: row.last_source,
      landingPage: row.landing_page,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      utmContent: row.utm_content,
      gclid: row.gclid,
    },
    notifications: {
      emailCustomerSent: row.email_customer_sent,
      emailBusinessSent: row.email_business_sent,
      telegramSent: row.telegram_sent,
      sheetsSent: row.sheets_sent,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
