// Builds the same POSTCODE+DDMMYY-style reference the public booking flow
// and admin's manual-booking creator use (see admin/api/_lib/
// customerLifecycle.js's buildManualBookingRef) — duplicated locally rather
// than imported, same cross-project-boundary reasoning as elsewhere in this
// codebase. This client-side copy is a convenience prefill only (no
// uniqueness suffix, no DB check): the invoice's booking reference is a
// free-text field, not a unique key, so a plain best-effort base is enough.
export function buildBookingRefBase(postcode: string | null | undefined, dateStr: string | null | undefined): string | null {
  const pc = (postcode || '').replace(/\s+/g, '').toUpperCase();
  if (!pc) return null;
  const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  const dd = `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCFullYear()).slice(2)}`;
  return pc + dd;
}
