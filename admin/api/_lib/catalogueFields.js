// Shared field whitelists, input validation and row mapping for the
// Products & Services catalogue (table: catalogue_items, route:
// admin/api/catalogue.js). Mirrors the style of invoiceFields.js /
// bookingFields.js — every value the database ever sees is validated here
// first; the route never trusts client input.
//
// Money invariant: prices are stored and transmitted as integer pence
// (default_price_pence / defaultPricePence). Pounds only ever appear in
// the browser's display layer, which divides by 100 exactly.

export const CATALOGUE_ITEM_TYPE_VALUES = ['service', 'product'];
export const CATALOGUE_STATUS_VALUES = ['active', 'archived'];

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CATEGORY_LENGTH = 60;
// £100,000 — a generous ceiling that still rejects obvious garbage.
const MAX_PRICE_PENCE = 10_000_000;

function validateOptionalText(raw, field, maxLength) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: `${field} must be a string` };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) return { ok: false, error: `${field} must be ${maxLength} characters or fewer` };
  return { ok: true, value: trimmed };
}

function validatePricePence(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ok: false, error: 'defaultPricePence must be a number' };
  }
  if (!Number.isInteger(raw)) {
    return { ok: false, error: 'defaultPricePence must be a whole number of pence' };
  }
  if (raw < 0) {
    return { ok: false, error: 'defaultPricePence must not be negative' };
  }
  if (raw > MAX_PRICE_PENCE) {
    return { ok: false, error: 'defaultPricePence is unreasonably large' };
  }
  return { ok: true, value: raw };
}

// Validates a create payload (all required fields) or an update payload
// (partial: only fields present in `body` are validated and returned, so an
// update can change one field without restating the others). Returns
// { ok: true, value } where value is a snake_case row fragment ready for
// insert/update, or { ok: false, error }.
export function validateCatalogueItemInput(body, { partial = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be an object' };
  }

  const row = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (!partial || has('name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return { ok: false, error: 'name is required' };
    }
    const name = body.name.trim();
    if (name.length > MAX_NAME_LENGTH) {
      return { ok: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
    }
    row.name = name;
  }

  if (!partial || has('description')) {
    const check = validateOptionalText(body.description, 'description', MAX_DESCRIPTION_LENGTH);
    if (!check.ok) return check;
    row.description = check.value;
  }

  if (!partial || has('defaultPricePence')) {
    const check = validatePricePence(body.defaultPricePence);
    if (!check.ok) return check;
    row.default_price_pence = check.value;
  }

  if (!partial || has('itemType')) {
    if (!CATALOGUE_ITEM_TYPE_VALUES.includes(body.itemType)) {
      return { ok: false, error: `itemType must be one of: ${CATALOGUE_ITEM_TYPE_VALUES.join(', ')}` };
    }
    row.item_type = body.itemType;
  }

  if (!partial || has('category')) {
    const check = validateOptionalText(body.category, 'category', MAX_CATEGORY_LENGTH);
    if (!check.ok) return check;
    row.category = check.value;
  }

  if (has('status')) {
    if (!CATALOGUE_STATUS_VALUES.includes(body.status)) {
      return { ok: false, error: `status must be one of: ${CATALOGUE_STATUS_VALUES.join(', ')}` };
    }
    row.status = body.status;
  }

  if (partial && Object.keys(row).length === 0) {
    return { ok: false, error: 'No updatable fields supplied' };
  }

  return { ok: true, value: row };
}

// snake_case row → camelCase API shape (never exposes anything beyond the
// catalogue's own columns — the table holds no sensitive data).
export function toCatalogueItem(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    defaultPricePence: row.default_price_pence,
    itemType: row.item_type,
    category: row.category ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
