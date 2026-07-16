const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

const MAX_SEARCH_QUERY_LENGTH = 100;
// Short enough to allow a postcode outward code ("N15", "E1") or a 2-letter
// name fragment; the UUID branch below is a safety net, not the reason this
// is short — a UUID is always 36 characters, well past this floor anyway.
const MIN_SEARCH_QUERY_LENGTH = 2;

// Validates a raw search query string before it ever reaches SQL. Returns
// { ok: true, value } with the trimmed query, or { ok: false, error }.
export function validateSearchQuery(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'q must be a string' };
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: 'q must not be empty' };
  }

  if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
    return { ok: false, error: 'q is too long' };
  }

  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH && !isValidUuid(trimmed)) {
    return { ok: false, error: 'q is too short' };
  }

  return { ok: true, value: trimmed };
}

// Basic sanity check for free-text filter values (service/source/postcode)
// that don't have a fixed enum — rejects control characters and caps
// length. Actual query safety against injection comes from always passing
// these through Supabase's parameterised query builder (.eq/.ilike), never
// through string-concatenated SQL — this is a data-quality/abuse guard on
// top of that, not the injection defence itself.
const MAX_FILTER_VALUE_LENGTH = 100;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

export function sanitiseFreeTextFilter(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_FILTER_VALUE_LENGTH) return null;
  if (CONTROL_CHAR_RE.test(trimmed)) return null;
  return trimmed;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function isValidIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

// Deliberately simple — good enough to catch obvious typos/empty strings
// before an email send attempt, not a full RFC 5322 validator. The mail
// provider itself is the real source of truth on deliverability.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

// Internal notes are append-only free text with a sensible ceiling — long
// enough for a real handover note, short enough to stay a note rather than
// a document.
const MAX_NOTE_LENGTH = 2000;

export function validateNote(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'note must be a string' };
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: 'note must not be empty' };
  }

  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  return { ok: true, value: trimmed };
}
