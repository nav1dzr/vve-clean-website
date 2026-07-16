// Whitelists and safe field projections for `customers`, mirroring
// bookingFields.js/invoiceFields.js exactly: explicit column allowlists,
// never `select('*')` from a route, every row mapped through a to*()
// function before it reaches an API response.

export const CUSTOMER_TYPE_VALUES = ['individual', 'landlord', 'letting_agent', 'agency', 'business'];
export const CUSTOMER_SOURCE_VALUES = ['website', 'phone', 'whatsapp', 'email', 'referral', 'google', 'repeat_customer', 'other'];
export const CUSTOMER_CONTACT_METHOD_VALUES = ['phone', 'email', 'whatsapp'];
export const CUSTOMER_SORT_VALUES = ['newest', 'oldest', 'name'];

export const CUSTOMER_CARD_SELECT = [
  'id', 'name', 'email', 'phone', 'postcode', 'customer_type', 'source', 'created_at',
].join(', ');

export const CUSTOMER_DETAIL_SELECT = [
  'id', 'name', 'email', 'phone', 'address', 'postcode',
  'customer_type', 'source', 'preferred_contact_method', 'notes',
  'created_by_admin_id', 'created_at', 'updated_at',
].join(', ');

export function toCustomerCard(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    postcode: row.postcode,
    customerType: row.customer_type,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function toCustomerDetail(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    postcode: row.postcode,
    customerType: row.customer_type,
    source: row.source,
    preferredContactMethod: row.preferred_contact_method,
    notes: row.notes,
    createdByAdminId: row.created_by_admin_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // normalised_email/normalised_phone are intentionally excluded — they
    // are internal dedup-matching keys, not customer-facing data.
  };
}

export function toDuplicateWarningCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    postcode: row.postcode,
  };
}
