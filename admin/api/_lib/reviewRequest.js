import { emailWordmarkHtml, BRAND_BLUE } from './brandWordmark.js';

// Manual "Send review request" support.
//
// Google review velocity is the single biggest lever for a local cleaning
// business, and nothing in the system currently asks for one — it depends
// entirely on customers volunteering.
//
// This module is deliberately conservative. It ships OFF, it never sends
// anything by itself, and it degrades to "unavailable" rather than erroring if
// its database columns have not been migrated yet.
//
// ── Why it is disabled by default ────────────────────────────────────────────
// Enabling it requires TWO independent steps, so neither an accidental deploy
// nor an accidental migration can start emailing real customers:
//   1. apply admin/migrations/20260803120000_add_review_request_tracking.sql
//      (manual — see admin/PHASE4_MIGRATIONS.md); and
//   2. set REVIEW_REQUESTS_ENABLED=true on the admin Vercel project.
// With either step missing the endpoint returns 503 and sends nothing.

/** The real, existing "write a review" URL — same one the public site uses. */
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CYDRQCaICK7vEAE/review';

/**
 * Master switch. Off unless explicitly set to the string 'true'.
 *
 * Also hard-off under test and in development regardless of the env var, so a
 * misconfigured .env or a test run can never email a real customer.
 */
export function isReviewRequestEnabled(env = process.env) {
  if (env.NODE_ENV === 'test' || env.VITEST) return false;
  return env.REVIEW_REQUESTS_ENABLED === 'true';
}

/**
 * True when the bookings table has the tracking columns.
 *
 * The feature must never take the CRM down because a migration has not been
 * run, so callers check this and report "unavailable" instead of surfacing a
 * Postgres "column does not exist" error.
 */
export function hasTrackingColumns(bookingRow) {
  return bookingRow !== null
    && typeof bookingRow === 'object'
    && 'review_request_sent_at' in bookingRow;
}

/**
 * Why a booking may not be asked for a review.
 * Returns null when it is eligible, otherwise a machine-readable reason.
 */
export function reviewRequestBlockedReason(booking) {
  if (!booking) return 'not_found';

  // Only a finished job. Asking someone for a review before the work is done
  // is worse than not asking at all.
  if (booking.status !== 'completed') return 'not_completed';

  // A booking that never paid is not a customer relationship worth mining.
  if (booking.payment_status !== 'paid') return 'not_paid';

  if (!booking.email || !String(booking.email).includes('@')) return 'no_email';

  // Duplicate protection. Persisted, so it survives a page reload, a different
  // operator, and a different device.
  if (booking.review_request_sent_at) return 'already_sent';

  return null;
}

export function isReviewRequestEligible(booking) {
  return reviewRequestBlockedReason(booking) === null;
}

/** Human-readable explanation, for the CRM to show next to a disabled button. */
export const BLOCKED_REASON_TEXT = {
  not_found: 'Booking not found.',
  not_completed: 'The booking is not marked completed yet.',
  not_paid: 'The deposit has not been paid.',
  no_email: 'No email address is stored for this customer.',
  already_sent: 'A review request has already been sent for this booking.',
  feature_disabled: 'Review requests are switched off.',
  columns_missing: 'Review-request tracking has not been migrated yet.',
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Builds the review-request email.
 *
 * Uses the same wordmark helper as the invoice emails so the branding matches
 * the rest of the system, and makes no claim about the customer's experience —
 * it asks, it does not assume. No incentive is offered: incentivised reviews
 * breach Google's policies and would put the whole profile at risk.
 */
export function buildReviewRequestEmail({ fullName, bookingRef, service }) {
  const firstName = String(fullName ?? '').trim().split(/\s+/)[0] || 'there';
  const subject = 'How did we do? Leave VVE Clean a review';

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <tr><td style="padding:0 0 24px">${emailWordmarkHtml()}</td></tr>
    <tr><td style="padding:0 0 16px;font-size:20px;font-weight:700;color:#0f172a">Thanks for choosing VVE Clean, ${esc(firstName)}</td></tr>
    <tr><td style="padding:0 0 16px;font-size:15px;line-height:24px;color:#334155">
      We hope you were happy with your ${esc(service || 'clean')}. If you have a minute,
      a short review on Google genuinely helps a small local business like ours —
      and helps other people in your area find us.
    </td></tr>
    <tr><td style="padding:8px 0 24px">
      <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:${BRAND_BLUE};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px">Leave a review on Google</a>
    </td></tr>
    <tr><td style="padding:0 0 8px;font-size:13px;line-height:21px;color:#64748b">
      If something wasn&rsquo;t right, please reply to this email instead and we&rsquo;ll put it right —
      our 48-hour re-clean guarantee still applies.
    </td></tr>
    <tr><td style="padding:16px 0 0;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
      Booking reference ${esc(bookingRef)} &middot; VVE Clean &middot; 020 8050 2233
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Thanks for choosing VVE Clean, ${firstName}`,
    '',
    `We hope you were happy with your ${service || 'clean'}. If you have a minute, a short`,
    'review on Google genuinely helps a small local business like ours.',
    '',
    `Leave a review: ${GOOGLE_REVIEW_URL}`,
    '',
    "If something wasn't right, please reply to this email instead and we'll put it",
    'right — our 48-hour re-clean guarantee still applies.',
    '',
    `Booking reference ${bookingRef} · VVE Clean · 020 8050 2233`,
  ].join('\n');

  return { subject, html, text };
}
