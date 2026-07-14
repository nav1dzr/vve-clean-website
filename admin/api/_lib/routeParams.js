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
