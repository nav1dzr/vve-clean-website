// Shared helper for extracting a dynamic [id] path segment. Vercel
// populates req.query.id for bracket-route files; the manual parse is a
// fallback so every handler using this is testable (and correct)
// independent of the Vercel routing layer.
//
// `depthFromEnd` counts how many segments back from the end of the path the
// booking id sits: 0 for /api/bookings/:id (id is the last segment), 1 for
// /api/bookings/:id/notes (id is second-to-last), etc.
export function extractIdParam(req, depthFromEnd = 0) {
  if (req.query?.id) return req.query.id;
  const segments = new URL(req.url, 'https://x').pathname.split('/').filter(Boolean);
  return segments[segments.length - 1 - depthFromEnd];
}

// Companion helper for routes shaped /api/<resource>/[id]/[[...action]] —
// an optional Vercel catch-all, used by the invoice/receipt dispatchers to
// stay within the admin Vercel project's function-count budget
// (INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md §7) instead of one file per
// action. Returns { id, action } where `action` is always an array (empty
// when the request is just /api/<resource>/:id with no further segment).
//
// Vercel populates req.query.id/req.query.action for bracket routes; the
// manual pathname parse is a fallback so handlers using this stay testable
// independent of the Vercel routing layer, same rationale as
// extractIdParam above. The manual parse assumes exactly two fixed
// segments before :id (e.g. "api", "invoices") — true for every route
// this helper is used from.
export function extractIdAndAction(req) {
  if (req.query?.id) {
    const rawAction = req.query.action;
    const action = Array.isArray(rawAction) ? rawAction : (rawAction ? [rawAction] : []);
    return { id: req.query.id, action };
  }
  const segments = new URL(req.url, 'https://x').pathname.split('/').filter(Boolean);
  return { id: segments[2], action: segments.slice(3) };
}
