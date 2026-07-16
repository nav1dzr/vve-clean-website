// HTML-escaping helper for interpolating untrusted text into email bodies.
// Deliberately mirrors api/stripe-webhook.js's escHtml() exactly (same
// four-character escape set) rather than importing across the two
// independent Vercel projects — this repo's two `api/` trees do not share
// code, and a cross-project import would be a bigger, riskier change than
// duplicating four lines. Only escapes &, <, > — values here are always
// placed in HTML text-node contexts, never inside HTML attributes, so
// quote/apostrophe escaping is unnecessary (same rationale as the original).
export function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
