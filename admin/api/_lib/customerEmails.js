import { createHash } from 'node:crypto';
import { isValidUuid } from './normalise.js';
import { validateCustomerEmail, buildCustomerEmail } from './customerEmailTemplate.js';
import { getBusinessSettings } from './businessSettings.js';
import { isMailerConfigured, sendMail } from './mailer.js';

const PUBLIC_FIELDS = 'id,recipient,subject,body,style,status,created_at,attempted_at,accepted_at';
const fail = (status, error) => ({ ok: false, status, error });
function unavailable() { return fail(503, 'Customer email storage is not ready. Your existing booking and invoice emails are unaffected.'); }
function publicEmail(row) {
  return Object.fromEntries(PUBLIC_FIELDS.split(',').map(key => [key, row[key]]));
}
export async function listCustomerEmails(db, customerId) {
  const { data, error } = await db.from('customer_emails').select(PUBLIC_FIELDS).eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20);
  if (error) return unavailable();
  return { ok: true, emails: data || [], sendingConfigured: isMailerConfigured() };
}
export async function previewCustomerEmail(db, customerId, adminId, input) {
  if (!isValidUuid(input?.id)) return fail(400, 'A valid draft reference is required.');
  const parsed = validateCustomerEmail(input);
  if (!parsed.ok) return fail(400, parsed.error);
  const message = parsed.value;
  const hash = createHash('sha256').update(JSON.stringify(message)).digest('hex');
  const rendered = buildCustomerEmail(message, getBusinessSettings());
  const record = { id: input.id, customer_id: customerId, created_by: adminId, ...message, content_hash: hash, html_snapshot: rendered.html, text_snapshot: rendered.text };
  const { data, error } = await db.from('customer_emails').insert(record).select('*').single();
  if (error) {
    if (error.code !== '23505') return unavailable();
    const existing = await db.from('customer_emails').select('*').eq('id', input.id).eq('customer_id', customerId).maybeSingle();
    if (existing.error || !existing.data || existing.data.content_hash !== hash) return fail(409, 'This draft reference already belongs to different content. Review a new draft.');
    if (existing.data.status !== 'draft') return fail(409, 'This email has already been submitted. Check its history before creating another.');
    return { ok: true, email: publicEmail(existing.data), html: existing.data.html_snapshot.split('<body style="margin:0">')[1].split('</body>')[0], text: existing.data.text_snapshot };
  }
  return { ok: true, email: publicEmail(data), html: rendered.fragment, text: rendered.text };
}
export async function sendCustomerEmail(db, customerId, input, deps = {}) {
  if (!isValidUuid(input?.id)) return fail(400, 'Choose a saved preview first.');
  const { data: draft, error } = await db.from('customer_emails').select('*').eq('id', input.id).eq('customer_id', customerId).maybeSingle();
  if (error) return unavailable();
  if (!draft) return fail(404, 'Email draft not found.');
  if (input.confirmedRecipient !== draft.recipient) return fail(409, 'Check the recipient in the preview before sending.');
  if (draft.status !== 'draft') return { ok: true, email: publicEmail(draft), duplicatePrevented: true };
  if (!(deps.isConfigured || isMailerConfigured)()) return fail(503, 'Email sending is not configured. Your draft is saved.');
  const attemptedAt = new Date().toISOString();
  const claimed = await db.from('customer_emails').update({ status: 'sending', attempted_at: attemptedAt }).eq('id', draft.id).eq('customer_id', customerId).eq('status', 'draft').select('*').maybeSingle();
  if (claimed.error) return unavailable();
  if (!claimed.data) {
    const latest = await db.from('customer_emails').select(PUBLIC_FIELDS).eq('id', draft.id).eq('customer_id', customerId).maybeSingle();
    return latest.data ? { ok: true, email: publicEmail(latest.data), duplicatePrevented: true } : fail(409, 'Sending may already be in progress. Check email history.');
  }
  // No retries after SMTP has been attempted. A lost response cannot prove the
  // provider rejected the message; a stable Message-ID helps manual tracing.
  let result;
  try {
    result = await (deps.send || sendMail)({ to: draft.recipient, subject: draft.subject, html: draft.html_snapshot, text: draft.text_snapshot, fromName: 'VVE Clean', messageId: '<vve-customer-' + draft.id + '@vveclean.co.uk>' });
  } catch { result = { ok: false }; }
  const status = result.ok ? 'accepted' : 'uncertain';
  const update = { status, accepted_at: result.ok ? new Date().toISOString() : null, provider_message_id: result.ok ? result.messageId : null };
  const saved = await db.from('customer_emails').update(update).eq('id', draft.id).eq('status', 'sending').select(PUBLIC_FIELDS).maybeSingle();
  if (saved.error || !saved.data) return { ok: true, email: publicEmail({ ...draft, status: 'uncertain', attempted_at: attemptedAt }), warning: 'Sending was attempted, but its final status could not be saved. Check Sent mail before sending anything again.' };
  return { ok: true, email: publicEmail(saved.data) };
}
