// Invoice email queue: "send now" and "schedule send" for issued invoices.
//
// One row per intended email. The row's id is generated in the browser, so a
// double-tap or a retried request can only ever create one row. A row is
// claimed (scheduled -> sending) with a conditional update before any mail is
// attempted, so two workers can never send the same row. The invoice is
// re-checked immediately before sending; anything that changed since the
// owner approved the send holds the email for review instead of sending.
//
// SMTP cannot give exactly-once delivery and this module does not claim it.
// A failure before transmission is retried automatically (three attempts).
// A failure during or after transmission is recorded as "uncertain" and is
// never retried automatically: only the owner can decide, after checking
// Sent mail, whether it went.
import { timingSafeEqual } from 'node:crypto';
import { isValidUuid, isValidEmail } from './normalise.js';
import { getBusinessSettings } from './businessSettings.js';
import { missingCombinedPaymentMethod, resolveInvoicePaymentInstructions } from './paymentOptions.js';
import { invoiceEmail } from './invoiceEmailTemplates.js';
import { generateInvoicePdfBuffer } from './invoicePdf.js';
import { invoicePdfPath, uploadPdf, downloadPdfBuffer } from './invoiceStorage.js';
import { sendMail, isMailerConfigured } from './mailer.js';

const TABLE = 'invoice_email_outbox';
// Rows that still need the worker or the owner. At most one per invoice.
export const OPEN_STATUSES = ['scheduled', 'sending', 'held', 'uncertain'];
const MAX_AUTOMATIC_ATTEMPTS = 3;
const RETRY_DELAYS_MINUTES = [5, 15, 45];
const STUCK_SENDING_MINUTES = 10;
const MAX_LATE_MINUTES = 120;
const EARLIEST_HOUR = 7;   // 07:00 UK time
const LATEST_HOUR = 21;    // nothing at or after 21:00 UK time
const MAX_DAYS_AHEAD = 60;
const MAX_MESSAGE_LENGTH = 2000;

const HOLD_TEXT = {
  invoice_replaced: 'This invoice was replaced by a revised invoice.',
  details_corrected: 'The invoice details were corrected after this email was scheduled.',
  balance_changed: 'The amount due changed after this email was scheduled.',
  payment_details_incomplete: 'The payment details on this invoice are incomplete.',
  recipient_invalid: 'The recipient email address is not valid.',
  not_issued: 'This invoice is not issued.',
  missed_send_time: 'The send time was missed, so nothing was sent.',
  delivery_failed: 'The email could not be sent.',
};
const CANCEL_TEXT = {
  cancelled_by_owner: 'Cancelled.',
  already_paid: 'Not sent: the invoice was already paid.',
  invoice_void: 'Not sent: the invoice was voided.',
  invoice_deleted: 'Not sent: the invoice no longer exists.',
  resent_after_uncertain: 'Replaced by a new send.',
};

const fail = (status, error) => ({ ok: false, status, error });
const unavailable = () => fail(503, 'Scheduled emails are not available right now. Nothing was sent or changed. Please retry.');

export function invoiceEmailQueueEnabled() {
  return process.env.INVOICE_EMAIL_QUEUE_ENABLED === 'true';
}

// The scheduler authenticates with its own long secret, never an admin login.
export function isInvoiceEmailWorker(req) {
  const expected = process.env.INVOICE_EMAIL_WORKER_SECRET || '';
  const actual = String(req.headers?.authorization || '').replace(/^Bearer /, '');
  return expected.length >= 32 && Buffer.byteLength(actual) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

// ---- UK time ---------------------------------------------------------------

const londonFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function londonParts(date) {
  const parts = Object.fromEntries(londonFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, hour: Number(parts.hour) };
}

// Converts a UK wall-clock date and time to the instant it refers to. UK time
// is UTC or UTC+1, so try both and keep the one that reads back identically.
// Returns null for a time that does not exist (the spring clock change).
export function londonLocalToUtc(dateStr, timeStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  if (!Number.isFinite(guess)) return null;
  for (const offsetMinutes of [60, 0]) {
    const candidate = new Date(guess - offsetMinutes * 60000);
    const read = londonParts(candidate);
    if (read.date === dateStr && read.time === timeStr) return candidate;
  }
  return null;
}

export function validateScheduleTime(dateStr, timeStr, now = new Date()) {
  if (typeof dateStr !== 'string' || typeof timeStr !== 'string') return fail(400, 'Choose a date and time.');
  const instant = londonLocalToUtc(dateStr, timeStr);
  if (!instant) return fail(400, 'Choose a valid UK date and time.');
  const [hh, mm] = timeStr.split(':').map(Number);
  if (mm % 15 !== 0) return fail(400, 'Choose a time on the quarter hour.');
  if (hh < EARLIEST_HOUR || hh >= LATEST_HOUR) return fail(400, 'Choose a time between 07:00 and 20:45 UK time.');
  if (instant.getTime() <= now.getTime()) return fail(400, 'Choose a time in the future, or use Send now.');
  if (instant.getTime() - now.getTime() > MAX_DAYS_AHEAD * 86400000) return fail(400, `Choose a time within the next ${MAX_DAYS_AHEAD} days.`);
  return { ok: true, instant };
}

// ---- Invoice checks ---------------------------------------------------------

// Decides what an email approved earlier should do against the invoice as it
// stands now. `row` carries what the owner approved.
export function checkInvoiceForSend(invoice, row) {
  if (!invoice) return { action: 'cancel', reason: 'invoice_deleted' };
  if (['void', 'cancelled'].includes(invoice.document_status)) return { action: 'cancel', reason: 'invoice_void' };
  if (invoice.document_status !== 'issued') return { action: 'hold', reason: 'not_issued' };
  if (invoice.superseded_by_invoice_id) return { action: 'hold', reason: 'invoice_replaced' };
  if (invoice.payment_status === 'paid' || !(Number(invoice.amount_due) > 0)) return { action: 'cancel', reason: 'already_paid' };
  if (Number(invoice.document_version || 1) !== Number(row.expected_document_version)) return { action: 'hold', reason: 'details_corrected' };
  if (Math.round(Number(invoice.amount_due) * 100) !== Math.round(Number(row.expected_amount_due) * 100)) return { action: 'hold', reason: 'balance_changed' };
  if (missingCombinedPaymentMethod(resolveInvoicePaymentInstructions(invoice))) return { action: 'hold', reason: 'payment_details_incomplete' };
  if (!isValidEmail(row.recipient)) return { action: 'hold', reason: 'recipient_invalid' };
  return { action: 'send' };
}

function schedulingError(invoice) {
  if (!invoice) return fail(404, 'Invoice not found');
  if (invoice.document_status !== 'issued') return fail(409, 'Only an issued invoice can be emailed. Issue it first.');
  if (invoice.superseded_by_invoice_id) return fail(409, 'This invoice was replaced by a revised invoice. Send the replacement instead.');
  if (invoice.payment_status === 'paid' || !(Number(invoice.amount_due) > 0)) return fail(409, 'This invoice is fully paid. Send the receipt instead.');
  const missing = missingCombinedPaymentMethod(resolveInvoicePaymentInstructions(invoice));
  if (missing) return fail(409, `This invoice is missing ${missing}. Correct it before sending.`);
  return null;
}

export function toOutboxView(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    recipient: row.recipient,
    message: row.custom_message || null,
    scheduledFor: row.scheduled_for,
    status: row.status,
    attempts: row.attempts || 0,
    sentAt: row.sent_at || null,
    attemptedAt: row.claimed_at || null,
    reason: row.status === 'held' ? (HOLD_TEXT[row.hold_reason] || 'Needs your review.')
      : row.status === 'cancelled' ? (CANCEL_TEXT[row.cancel_reason] || 'Cancelled.')
      : null,
    reasonCode: row.status === 'held' ? row.hold_reason || null : row.status === 'cancelled' ? row.cancel_reason || null : null,
    expectedAmountDue: row.expected_amount_due,
    createdAt: row.created_at,
  };
}

async function loadInvoice(db, invoiceId) {
  const { data, error } = await db.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  return { invoice: data || null, error };
}

async function loadRow(db, invoiceId, id) {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).eq('invoice_id', invoiceId).maybeSingle();
  return { row: data || null, error };
}

// ---- Owner actions ----------------------------------------------------------

export async function listInvoiceEmails(db, invoiceId) {
  const { data, error } = await db.from(TABLE).select('*').eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return unavailable();
  return { ok: true, emails: (data || []).map(toOutboxView) };
}

// Everything still waiting for its time or for the owner, across all invoices.
export async function listOpenInvoiceEmails(db) {
  const { data, error } = await db.from(TABLE).select('*').in('status', OPEN_STATUSES)
    .order('scheduled_for', { ascending: true }).limit(100);
  if (error) return unavailable();
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.invoice_id))];
  let invoices = [];
  if (ids.length) {
    const result = await db.from('invoices').select('id, invoice_number, customer_name, amount_due').in('id', ids);
    if (result.error) return unavailable();
    invoices = result.data || [];
  }
  const byId = new Map(invoices.map((i) => [i.id, i]));
  return {
    ok: true,
    emails: rows.map((r) => ({
      ...toOutboxView(r),
      invoiceNumber: byId.get(r.invoice_id)?.invoice_number || null,
      customerName: byId.get(r.invoice_id)?.customer_name || null,
      amountDue: byId.get(r.invoice_id)?.amount_due ?? null,
    })),
  };
}

// Creates the queue row. `input.sendNow` queues it for immediately; otherwise
// `input.date` + `input.time` are UK wall-clock values.
export async function queueInvoiceEmail(db, invoiceId, input, adminId, { now = new Date() } = {}) {
  if (!isValidUuid(input?.id)) return fail(400, 'Reopen Send to create a safe email request.');
  if (input.to !== undefined && input.to !== null && input.to !== '' && !isValidEmail(input.to)) return fail(400, 'Enter a valid recipient email address.');
  if (input.message !== undefined && input.message !== null && (typeof input.message !== 'string' || input.message.length > MAX_MESSAGE_LENGTH)) {
    return fail(400, `Keep the message under ${MAX_MESSAGE_LENGTH} characters.`);
  }
  let scheduledFor = now;
  if (!input.sendNow) {
    const time = validateScheduleTime(input.date, input.time, now);
    if (!time.ok) return time;
    scheduledFor = time.instant;
  }

  const { invoice, error } = await loadInvoice(db, invoiceId);
  if (error) return unavailable();
  const blocked = schedulingError(invoice);
  if (blocked) return blocked;
  const recipient = input.to || invoice.invoice_recipient_email || invoice.customer_email;
  if (!recipient || !isValidEmail(recipient)) return fail(400, 'No valid recipient email is available for this invoice.');

  // A repeated request with the same id is the same email, never a second one.
  const previous = await db.from(TABLE).select('*').eq('id', input.id).maybeSingle();
  if (previous.error) return unavailable();
  if (previous.data) {
    if (previous.data.invoice_id !== invoiceId) return fail(409, 'This email request belongs to a different invoice. Reopen Send and try again.');
    return { ok: true, row: previous.data, replayed: true };
  }
  const open = await db.from(TABLE).select('id, status').eq('invoice_id', invoiceId).in('status', OPEN_STATUSES);
  if (open.error) return unavailable();
  if ((open.data || []).length) {
    return fail(409, open.data[0].status === 'uncertain'
      ? 'An earlier email for this invoice could not be confirmed. Resolve it before sending another.'
      : 'This invoice already has an email waiting. Edit or cancel it first.');
  }

  const iso = scheduledFor.toISOString();
  const { data, error: insertError } = await db.from(TABLE).insert({
    id: input.id,
    invoice_id: invoiceId,
    kind: 'invoice',
    recipient,
    custom_message: typeof input.message === 'string' && input.message.trim() ? input.message.trim() : null,
    expected_document_version: Number(invoice.document_version || 1),
    expected_amount_due: invoice.amount_due,
    scheduled_for: iso,
    next_attempt_at: iso,
    status: 'scheduled',
    attempts: 0,
    created_by: adminId,
    updated_at: now.toISOString(),
  }).select('*').single();
  if (insertError) {
    // The database index allows one open email per invoice; a concurrent
    // request may have won. Never report that as a failure to retry blindly.
    if (insertError.code === '23505') {
      const again = await db.from(TABLE).select('*').eq('id', input.id).maybeSingle();
      if (again.data && again.data.invoice_id === invoiceId) return { ok: true, row: again.data, replayed: true };
      return fail(409, 'This invoice already has an email waiting. Edit or cancel it first.');
    }
    return unavailable();
  }
  return { ok: true, row: data, replayed: false };
}

export async function cancelInvoiceEmail(db, invoiceId, id, { now = new Date() } = {}) {
  if (!isValidUuid(id)) return fail(400, 'A valid email reference is required.');
  const { data, error } = await db.from(TABLE)
    .update({ status: 'cancelled', cancel_reason: 'cancelled_by_owner', updated_at: now.toISOString() })
    .eq('id', id).eq('invoice_id', invoiceId).in('status', ['scheduled', 'held']).select('*').maybeSingle();
  if (error) return unavailable();
  if (!data) return fail(409, 'This email can no longer be cancelled. It may already be sending or sent. Reload to check.');
  return { ok: true, row: data };
}

// Moves a waiting or held email to a new time. The owner is reviewing the
// invoice as it is now, so the approved version and balance are refreshed.
export async function rescheduleInvoiceEmail(db, invoiceId, id, input, { now = new Date() } = {}) {
  if (!isValidUuid(id)) return fail(400, 'A valid email reference is required.');
  const time = validateScheduleTime(input?.date, input?.time, now);
  if (!time.ok) return time;
  const { invoice, error } = await loadInvoice(db, invoiceId);
  if (error) return unavailable();
  const blocked = schedulingError(invoice);
  if (blocked) return blocked;
  const iso = time.instant.toISOString();
  const { data, error: updateError } = await db.from(TABLE).update({
    status: 'scheduled', scheduled_for: iso, next_attempt_at: iso, attempts: 0, hold_reason: null, last_error_code: null,
    expected_document_version: Number(invoice.document_version || 1), expected_amount_due: invoice.amount_due,
    updated_at: now.toISOString(),
  }).eq('id', id).eq('invoice_id', invoiceId).in('status', ['scheduled', 'held']).select('*').maybeSingle();
  if (updateError) return unavailable();
  if (!data) return fail(409, 'This email can no longer be changed. It may already be sending or sent. Reload to check.');
  return { ok: true, row: data };
}

// Sends a waiting or held email immediately. The owner has the current
// invoice in front of them, so the approved version and balance are refreshed
// first; a replaced, paid or void invoice is still refused by the send check.
export async function sendInvoiceEmailNow(db, invoiceId, id, adminId, { now = new Date(), deps } = {}) {
  if (!isValidUuid(id)) return fail(400, 'A valid email reference is required.');
  const { row, error } = await loadRow(db, invoiceId, id);
  if (error) return unavailable();
  if (!row) return fail(404, 'Email not found.');
  if (row.status === 'sent') return { ok: true, row, outcome: 'sent', replayed: true };
  if (!['scheduled', 'held'].includes(row.status)) return fail(409, 'This email is already being handled. Reload to check its status.');
  const { invoice, error: invoiceError } = await loadInvoice(db, invoiceId);
  if (invoiceError) return unavailable();
  const blocked = schedulingError(invoice);
  if (blocked) return blocked;
  const refreshed = await db.from(TABLE).update({
    expected_document_version: Number(invoice.document_version || 1), expected_amount_due: invoice.amount_due,
    hold_reason: null, updated_at: now.toISOString(),
  }).eq('id', id).eq('status', row.status).eq('attempts', row.attempts || 0).select('*').maybeSingle();
  if (refreshed.error) return unavailable();
  if (!refreshed.data) return fail(409, 'This email is already being handled. Reload to check its status.');
  return processInvoiceEmail(db, refreshed.data, { now, manual: true, adminId, deps });
}

// The owner resolves an email whose delivery could not be confirmed.
export async function resolveUncertainInvoiceEmail(db, invoiceId, id, resolution, adminId, { now = new Date() } = {}) {
  if (!isValidUuid(id)) return fail(400, 'A valid email reference is required.');
  if (!['sent', 'not_sent'].includes(resolution)) return fail(400, 'Choose whether the email was sent.');
  const patch = resolution === 'sent'
    ? { status: 'sent', updated_at: now.toISOString() }
    : { status: 'cancelled', cancel_reason: 'resent_after_uncertain', updated_at: now.toISOString() };
  const { data, error } = await db.from(TABLE).update(patch)
    .eq('id', id).eq('invoice_id', invoiceId).eq('status', 'uncertain').select('*').maybeSingle();
  if (error) return unavailable();
  if (!data) return fail(409, 'This email is no longer waiting for your decision. Reload to check its status.');
  if (resolution === 'sent') {
    const sentAt = data.claimed_at || now.toISOString();
    await db.from(TABLE).update({ sent_at: sentAt }).eq('id', id);
    const { invoice } = await loadInvoice(db, invoiceId);
    await recordSent(db, invoice, { ...data, sent_at: sentAt }, adminId, { messageId: null, confirmedByOwner: true, at: sentAt });
  }
  return { ok: true, row: data };
}

// ---- Sending ----------------------------------------------------------------

async function recordSent(db, invoice, row, adminId, { messageId, confirmedByOwner = false, at }) {
  const alreadySent = Boolean(invoice?.sent_at);
  await db.from('invoices').update({ sent_at: at, updated_at: at }).eq('id', row.invoice_id);
  await db.from('invoice_events').insert({
    document_type: 'invoice', document_id: row.invoice_id, event_type: alreadySent ? 'resent' : 'sent',
    admin_id: adminId || row.created_by || null,
    metadata: { to: row.recipient, messageId: messageId || null, emailId: row.id, ...(confirmedByOwner ? { confirmedByOwner: true } : {}) },
  });
}

async function settle(db, row, patch, now) {
  // Conditional on still being "sending": a row another process already
  // settled is never overwritten.
  const { data, error } = await db.from(TABLE).update({ ...patch, updated_at: now.toISOString() })
    .eq('id', row.id).eq('status', 'sending').select('*').maybeSingle();
  return error ? null : data;
}

// Claims one row and takes it to a final or waiting state. Never throws.
export async function processInvoiceEmail(db, row, { now = new Date(), manual = false, adminId = null, deps = {} } = {}) {
  const send = deps.send || sendMail;
  const configured = deps.isConfigured || isMailerConfigured;
  // Only an email that is waiting may be claimed. One already being sent, or
  // already settled, is never picked up a second time.
  if (!['scheduled', 'held'].includes(row.status)) return { ok: true, outcome: 'skipped', row };
  const claim = await db.from(TABLE).update({
    status: 'sending', claimed_at: now.toISOString(), attempts: (row.attempts || 0) + 1, updated_at: now.toISOString(),
  }).eq('id', row.id).eq('status', row.status).eq('attempts', row.attempts || 0).select('*').maybeSingle();
  if (claim.error || !claim.data) return { ok: true, outcome: 'skipped', row };
  const claimed = claim.data;
  const result = (outcome, settled, extra = {}) => ({ ok: true, outcome, row: settled || claimed, ...extra });
  const retryOrHold = async (code) => {
    if (!manual && claimed.attempts < MAX_AUTOMATIC_ATTEMPTS) {
      const delay = RETRY_DELAYS_MINUTES[Math.min(claimed.attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
      const next = new Date(now.getTime() + delay * 60000).toISOString();
      return result('retry_later', await settle(db, claimed, { status: 'scheduled', next_attempt_at: next, last_error_code: code }, now));
    }
    return result('held', await settle(db, claimed, { status: 'held', hold_reason: 'delivery_failed', last_error_code: code }, now),
      { error: 'The email could not be sent. Nothing reached the customer. Try again, or check the email settings.' });
  };

  try {
    const { invoice, error } = await loadInvoice(db, claimed.invoice_id);
    if (error) return await retryOrHold('invoice_read_failed');
    const check = checkInvoiceForSend(invoice, claimed);
    if (check.action === 'cancel') {
      return result('cancelled', await settle(db, claimed, { status: 'cancelled', cancel_reason: check.reason }, now));
    }
    if (check.action === 'hold') {
      return result('held', await settle(db, claimed, { status: 'held', hold_reason: check.reason }, now), { error: HOLD_TEXT[check.reason] });
    }
    if (!manual) {
      const lateMinutes = (now.getTime() - new Date(claimed.scheduled_for).getTime()) / 60000;
      const hour = londonParts(now).hour;
      if (lateMinutes > MAX_LATE_MINUTES || hour < EARLIEST_HOUR || hour >= LATEST_HOUR) {
        return result('held', await settle(db, claimed, { status: 'held', hold_reason: 'missed_send_time' }, now));
      }
    }
    if (!configured()) return await retryOrHold('mailer_not_configured');

    const { data: items, error: itemsError } = await db.from('invoice_items').select('*')
      .eq('invoice_id', invoice.id).order('sort_order', { ascending: true });
    if (itemsError) return await retryOrHold('items_read_failed');

    // Always the stored issued PDF. It is generated from the invoice's own
    // frozen business details only if an older invoice never had one stored.
    let path = invoice.pdf_storage_path;
    if (!path) {
      const buffer = await generateInvoicePdfBuffer(invoice, items || [], invoice.business_snapshot || getBusinessSettings(), { isDraft: false });
      const uploaded = await uploadPdf(db, invoicePdfPath(invoice.id, invoice.document_version || 1), buffer);
      if (!uploaded.ok) return await retryOrHold('pdf_store_failed');
      path = uploaded.path;
      await db.from('invoices').update({ pdf_storage_path: path }).eq('id', invoice.id);
    }
    const pdf = await downloadPdfBuffer(db, path);
    if (!pdf.ok) return await retryOrHold('pdf_read_failed');

    const settings = invoice.business_snapshot || getBusinessSettings();
    const { subject, html, text } = invoiceEmail(invoice, settings, { customMessage: claimed.custom_message || undefined, items: items || [] });

    let mail;
    try {
      mail = await send({
        to: claimed.recipient, subject, html, text, fromName: settings.emailFromName,
        attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdf.buffer, contentType: 'application/pdf' }],
        // Fixed per email so the message is easy to find in Sent mail.
        messageId: `<vve-invoice-${claimed.id}@vveclean.co.uk>`,
      });
    } catch {
      mail = { ok: false, uncertain: true, code: 'send_threw' };
    }

    if (mail?.ok) {
      const at = now.toISOString();
      const settled = await settle(db, claimed, { status: 'sent', sent_at: at, provider_message_id: mail.messageId || null, last_error_code: null }, now);
      await recordSent(db, invoice, claimed, adminId, { messageId: mail.messageId, at });
      return result('sent', settled);
    }
    // Only a failure the mailer positively identifies as "before transmission"
    // may be retried. Anything else might have reached the customer.
    if (mail?.uncertain === false) {
      await db.from('invoice_events').insert({
        document_type: 'invoice', document_id: invoice.id, event_type: 'send_failed', admin_id: adminId || claimed.created_by || null,
        metadata: { to: claimed.recipient, emailId: claimed.id, error: 'not sent' },
      });
      return await retryOrHold(String(mail.code || 'send_rejected').slice(0, 40));
    }
    return result('uncertain', await settle(db, claimed, { status: 'uncertain', last_error_code: String(mail?.code || 'unconfirmed').slice(0, 40) }, now),
      { error: 'We could not confirm whether this email was sent. Check Sent mail in Gmail before sending again.' });
  } catch (err) {
    console.error('[admin/api] invoice email processing error:', err?.name || 'error');
    // Unknown point of failure: if mail may have been attempted the stuck-row
    // sweep will mark it uncertain; do not guess here.
    return { ok: true, outcome: 'uncertain', row: claimed, error: 'We could not confirm whether this email was sent. Check Sent mail in Gmail before sending again.' };
  }
}

// Called by the scheduler every few minutes. Bounded so one run always
// finishes inside the function time limit.
export async function processDueInvoiceEmails(db, { now = new Date(), limit = 5, deps } = {}) {
  const summary = { processed: 0, sent: 0, held: 0, cancelled: 0, uncertain: 0, retryLater: 0, skipped: 0 };
  // A row left "sending" means a run died mid-send. It may have been sent, so
  // it goes to the owner as uncertain. It is never sent again automatically.
  const stuckBefore = new Date(now.getTime() - STUCK_SENDING_MINUTES * 60000).toISOString();
  const stuck = await db.from(TABLE).update({ status: 'uncertain', last_error_code: 'interrupted', updated_at: now.toISOString() })
    .eq('status', 'sending').lte('claimed_at', stuckBefore).select('id');
  if (stuck.error) return { ok: false, status: 503, error: 'queue_unavailable' };
  summary.uncertain += (stuck.data || []).length;

  const due = await db.from(TABLE).select('*').eq('status', 'scheduled').lte('next_attempt_at', now.toISOString())
    .order('next_attempt_at', { ascending: true }).limit(limit);
  if (due.error) return { ok: false, status: 503, error: 'queue_unavailable' };
  for (const row of due.data || []) {
    const outcome = (await processInvoiceEmail(db, row, { now, deps })).outcome;
    summary.processed += 1;
    if (outcome === 'sent') summary.sent += 1;
    else if (outcome === 'held') summary.held += 1;
    else if (outcome === 'cancelled') summary.cancelled += 1;
    else if (outcome === 'uncertain') summary.uncertain += 1;
    else if (outcome === 'retry_later') summary.retryLater += 1;
    else summary.skipped += 1;
  }
  return { ok: true, ...summary };
}
