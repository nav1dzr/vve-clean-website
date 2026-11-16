import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { getBusinessSettings } from '../../../api/_lib/businessSettings.js';
import {
  londonLocalToUtc, validateScheduleTime, checkInvoiceForSend, queueInvoiceEmail, cancelInvoiceEmail,
  rescheduleInvoiceEmail, sendInvoiceEmailNow, resolveUncertainInvoiceEmail, processInvoiceEmail,
  processDueInvoiceEmails, listOpenInvoiceEmails, isInvoiceEmailWorker,
} from '../../../api/_lib/invoiceEmailOutbox.js';

// Synthetic records only. Mail is always a local stub; nothing leaves the test.
const INVOICE = '11111111-1111-4111-8111-111111111111';
const EMAIL_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMAIL_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN = 'admin-1';
const NIGHT = new Date('2026-11-16T22:00:00Z');      // 22:00 UK, the evening before
const MORNING = new Date('2026-11-17T08:02:00Z');    // 08:02 UK, just after the send time
const PDF_PATH = `invoices/${INVOICE}/invoice-v1.pdf`;

function invoiceRow(overrides = {}) {
  return {
    id: INVOICE, invoice_number: 'VVE-INV-2026-000900', document_status: 'issued', payment_status: 'unpaid',
    document_version: 1, total: 285, deposit_applied: 30, amount_paid: 0, amount_due: 255,
    customer_name: 'Sample Customer', customer_email: 'customer@example.invalid', due_date: '2026-11-24',
    payment_option: 'bank_transfer', payment_terms: 'Payment is due on the cleaning day.',
    business_snapshot: getBusinessSettings(), pdf_storage_path: PDF_PATH, sent_at: null,
    superseded_by_invoice_id: null, ...overrides,
  };
}

async function setup(invoiceOverrides = {}) {
  const db = createFakeSupabase({
    invoices: [invoiceRow(invoiceOverrides)],
    invoice_items: [{ id: 'item-1', invoice_id: INVOICE, description: 'End of tenancy clean', quantity: 1, unit_price: 285, line_discount: 0, line_total: 285, sort_order: 0 }],
  });
  await db.storage.from('financial-documents').upload(PDF_PATH, Buffer.from('%PDF-synthetic'));
  return db;
}
const outbox = (db) => db._tables.invoice_email_outbox || [];
const invoice = (db) => db._tables.invoices[0];
const deps = (send) => ({ send, isConfigured: () => true });
const accepted = () => vi.fn(async () => ({ ok: true, messageId: 'synthetic-id' }));
const schedule = (db, extra = {}) => queueInvoiceEmail(db, INVOICE, { id: EMAIL_A, date: '2026-11-17', time: '08:00', ...extra }, ADMIN, { now: NIGHT });

describe('UK time handling', () => {
  it('converts winter and summer wall-clock times to the right instant', () => {
    expect(londonLocalToUtc('2026-11-17', '08:00').toISOString()).toBe('2026-11-17T08:00:00.000Z');
    // Monday after the clocks go forward (28 March 2027): UK is UTC+1.
    expect(londonLocalToUtc('2027-03-29', '08:00').toISOString()).toBe('2027-03-29T07:00:00.000Z');
    // Monday after the clocks go back (31 October 2027): UK is UTC again.
    expect(londonLocalToUtc('2027-11-01', '08:00').toISOString()).toBe('2027-11-01T08:00:00.000Z');
  });

  it('rejects a time that does not exist on the spring clock change', () => {
    expect(londonLocalToUtc('2027-03-28', '01:30')).toBeNull();
  });

  it('only accepts future quarter-hour times between 07:00 and 20:45', () => {
    expect(validateScheduleTime('2026-11-17', '08:00', NIGHT).ok).toBe(true);
    expect(validateScheduleTime('2026-11-17', '20:45', NIGHT).ok).toBe(true);
    for (const [date, time] of [['2026-11-17', '08:10'], ['2026-11-17', '06:45'], ['2026-11-17', '21:00'], ['2026-11-16', '08:00'], ['2027-03-01', '08:00'], ['17/11/2026', '08:00']]) {
      expect(validateScheduleTime(date, time, NIGHT).ok).toBe(false);
    }
  });
});

describe('scheduling', () => {
  it('stores what the owner approved and the UK send time', async () => {
    const db = await setup();
    const result = await schedule(db, { message: '  Thank you  ' });
    expect(result.ok).toBe(true);
    expect(outbox(db)).toHaveLength(1);
    expect(outbox(db)[0]).toMatchObject({
      id: EMAIL_A, invoice_id: INVOICE, status: 'scheduled', recipient: 'customer@example.invalid', custom_message: 'Thank you',
      expected_document_version: 1, expected_amount_due: 255, scheduled_for: '2026-11-17T08:00:00.000Z', attempts: 0,
    });
  });

  it('treats a repeated request as the same email, and refuses a second one for the invoice', async () => {
    const db = await setup();
    await schedule(db);
    const replay = await schedule(db);
    expect(replay).toMatchObject({ ok: true, replayed: true });
    const second = await queueInvoiceEmail(db, INVOICE, { id: EMAIL_B, date: '2026-11-18', time: '09:00' }, ADMIN, { now: NIGHT });
    expect(second).toMatchObject({ ok: false, status: 409 });
    expect(outbox(db)).toHaveLength(1);
  });

  it.each([
    ['a draft', { document_status: 'draft' }],
    ['a void invoice', { document_status: 'void' }],
    ['a paid invoice', { payment_status: 'paid', amount_due: 0 }],
    ['a replaced invoice', { superseded_by_invoice_id: EMAIL_B }],
  ])('refuses to schedule %s', async (_label, overrides) => {
    const db = await setup(overrides);
    expect(await schedule(db)).toMatchObject({ ok: false, status: 409 });
    expect(outbox(db)).toHaveLength(0);
  });

  it('refuses an invalid recipient, an over-long message and a missing request id', async () => {
    const db = await setup();
    expect((await schedule(db, { to: 'not-an-email' })).status).toBe(400);
    expect((await schedule(db, { message: 'x'.repeat(2001) })).status).toBe(400);
    expect((await queueInvoiceEmail(db, INVOICE, { date: '2026-11-17', time: '08:00' }, ADMIN, { now: NIGHT })).status).toBe(400);
    expect(outbox(db)).toHaveLength(0);
  });

  it('can be cancelled or moved while waiting, but not once sent', async () => {
    const db = await setup();
    await schedule(db);
    const moved = await rescheduleInvoiceEmail(db, INVOICE, EMAIL_A, { date: '2026-11-18', time: '09:15' }, { now: NIGHT });
    expect(moved.row.scheduled_for).toBe('2026-11-18T09:15:00.000Z');
    expect((await cancelInvoiceEmail(db, INVOICE, EMAIL_A, { now: NIGHT })).row.status).toBe('cancelled');
    expect((await cancelInvoiceEmail(db, INVOICE, EMAIL_A, { now: NIGHT })).status).toBe(409);
    // A cancelled email no longer blocks a new one.
    expect((await queueInvoiceEmail(db, INVOICE, { id: EMAIL_B, date: '2026-11-18', time: '09:00' }, ADMIN, { now: NIGHT })).ok).toBe(true);
  });
});

describe('sending at the scheduled time', () => {
  it('does nothing before the time, then sends exactly once', async () => {
    const db = await setup();
    await schedule(db);
    const send = accepted();
    expect((await processDueInvoiceEmails(db, { now: new Date('2026-11-17T07:55:00Z'), deps: deps(send) })).processed).toBe(0);
    expect(send).not.toHaveBeenCalled();

    const run = await processDueInvoiceEmails(db, { now: MORNING, deps: deps(send) });
    expect(run).toMatchObject({ ok: true, processed: 1, sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe('customer@example.invalid');
    expect(mail.subject).toContain('VVE-INV-2026-000900');
    expect(mail.messageId).toBe(`<vve-invoice-${EMAIL_A}@vveclean.co.uk>`);
    expect(mail.attachments[0]).toMatchObject({ filename: 'VVE-INV-2026-000900.pdf', contentType: 'application/pdf' });
    expect(outbox(db)[0]).toMatchObject({ status: 'sent', attempts: 1, provider_message_id: 'synthetic-id' });
    expect(invoice(db).sent_at).toBe(MORNING.toISOString());
    expect(db._tables.invoice_events.filter((e) => e.event_type === 'sent')).toHaveLength(1);

    await processDueInvoiceEmails(db, { now: new Date('2026-11-17T08:07:00Z'), deps: deps(send) });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends once when two workers pick up the same email together', async () => {
    const db = await setup();
    const { row } = await schedule(db);
    const send = accepted();
    // Each worker read the row while it was still waiting.
    const [first, second] = [{ ...row }, { ...row }];
    const outcomes = await Promise.all([
      processInvoiceEmail(db, first, { now: MORNING, deps: deps(send) }),
      processInvoiceEmail(db, second, { now: MORNING, deps: deps(send) }),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(['sent', 'skipped']);
  });

  it.each([
    ['paid in full', { payment_status: 'paid', amount_due: 0 }, 'cancelled', 'already_paid'],
    ['voided', { document_status: 'void' }, 'cancelled', 'invoice_void'],
    ['replaced by a revision', { superseded_by_invoice_id: EMAIL_B }, 'held', 'invoice_replaced'],
    ['corrected (new document version)', { document_version: 2 }, 'held', 'details_corrected'],
    ['part paid (balance changed)', { payment_status: 'partially_paid', amount_due: 155 }, 'held', 'balance_changed'],
  ])('sends nothing when the invoice was %s after scheduling', async (_label, change, status, reason) => {
    const db = await setup();
    await schedule(db);
    Object.assign(invoice(db), change);
    const send = accepted();
    await processDueInvoiceEmails(db, { now: MORNING, deps: deps(send) });
    expect(send).not.toHaveBeenCalled();
    expect(outbox(db)[0].status).toBe(status);
    expect(outbox(db)[0][status === 'held' ? 'hold_reason' : 'cancel_reason']).toBe(reason);
    expect(invoice(db).sent_at).toBeNull();
  });

  it('never picks up an email that is already being sent or is settled', async () => {
    const db = await setup();
    const { row } = await schedule(db);
    const send = accepted();
    for (const status of ['sending', 'sent', 'uncertain', 'cancelled']) {
      expect((await processInvoiceEmail(db, { ...row, status }, { now: MORNING, deps: deps(send) })).outcome).toBe('skipped');
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('cancels when the invoice no longer exists', () => {
    expect(checkInvoiceForSend(null, {})).toEqual({ action: 'cancel', reason: 'invoice_deleted' });
  });

  it('holds instead of sending late or outside 07:00–21:00 UK time', async () => {
    const late = await setup();
    await schedule(late);
    const send = accepted();
    await processDueInvoiceEmails(late, { now: new Date('2026-11-17T10:30:00Z'), deps: deps(send) });
    expect(outbox(late)[0]).toMatchObject({ status: 'held', hold_reason: 'missed_send_time' });

    const night = await setup();
    await queueInvoiceEmail(night, INVOICE, { id: EMAIL_A, date: '2026-11-17', time: '20:45' }, ADMIN, { now: NIGHT });
    await processDueInvoiceEmails(night, { now: new Date('2026-11-17T21:05:00Z'), deps: deps(send) });
    expect(outbox(night)[0]).toMatchObject({ status: 'held', hold_reason: 'missed_send_time' });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('delivery outcomes', () => {
  it('retries a definite failure three times, then holds it for the owner', async () => {
    const db = await setup();
    await schedule(db);
    const send = vi.fn(async () => ({ ok: false, uncertain: false, code: 'EAUTH' }));
    await processDueInvoiceEmails(db, { now: MORNING, deps: deps(send) });
    expect(outbox(db)[0]).toMatchObject({ status: 'scheduled', attempts: 1, next_attempt_at: '2026-11-17T08:07:00.000Z', last_error_code: 'EAUTH' });
    // Not due again yet.
    await processDueInvoiceEmails(db, { now: new Date('2026-11-17T08:05:00Z'), deps: deps(send) });
    expect(send).toHaveBeenCalledTimes(1);
    await processDueInvoiceEmails(db, { now: new Date('2026-11-17T08:08:00Z'), deps: deps(send) });
    await processDueInvoiceEmails(db, { now: new Date('2026-11-17T08:30:00Z'), deps: deps(send) });
    expect(send).toHaveBeenCalledTimes(3);
    expect(outbox(db)[0]).toMatchObject({ status: 'held', hold_reason: 'delivery_failed', attempts: 3 });
    expect(invoice(db).sent_at).toBeNull();
  });

  it.each([
    ['a timeout', async () => ({ ok: false, uncertain: true, code: 'ETIMEDOUT' })],
    ['an unclassified failure', async () => ({ ok: false })],
    ['a thrown error', async () => { throw new Error('socket closed'); }],
  ])('marks %s as uncertain and never retries it automatically', async (_label, behaviour) => {
    const db = await setup();
    await schedule(db);
    const send = vi.fn(behaviour);
    await processDueInvoiceEmails(db, { now: MORNING, deps: deps(send) });
    expect(outbox(db)[0].status).toBe('uncertain');
    await processDueInvoiceEmails(db, { now: new Date('2026-11-17T08:20:00Z'), deps: deps(send) });
    await processDueInvoiceEmails(db, { now: new Date('2026-11-17T09:20:00Z'), deps: deps(send) });
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox(db)[0].status).toBe('uncertain');
    // Still blocks a fresh email until the owner decides.
    expect((await queueInvoiceEmail(db, INVOICE, { id: EMAIL_B, sendNow: true }, ADMIN, { now: MORNING })).status).toBe(409);
  });

  it('turns an interrupted send into uncertain instead of sending it again', async () => {
    const db = await setup();
    await schedule(db);
    Object.assign(outbox(db)[0], { status: 'sending', claimed_at: '2026-11-17T08:00:00.000Z', attempts: 1 });
    const send = accepted();
    const run = await processDueInvoiceEmails(db, { now: new Date('2026-11-17T08:15:00Z'), deps: deps(send) });
    expect(run.uncertain).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(outbox(db)[0]).toMatchObject({ status: 'uncertain', last_error_code: 'interrupted' });
  });

  it('lets the owner resolve an uncertain email either way', async () => {
    const db = await setup();
    await schedule(db);
    await processDueInvoiceEmails(db, { now: MORNING, deps: deps(vi.fn(async () => ({ ok: false, uncertain: true }))) });

    const confirmed = await resolveUncertainInvoiceEmail(db, INVOICE, EMAIL_A, 'sent', ADMIN, { now: MORNING });
    expect(confirmed.ok).toBe(true);
    expect(outbox(db)[0].status).toBe('sent');
    expect(invoice(db).sent_at).toBeTruthy();
    expect(db._tables.invoice_events.find((e) => e.event_type === 'sent').metadata.confirmedByOwner).toBe(true);
    // A decision is made once.
    expect((await resolveUncertainInvoiceEmail(db, INVOICE, EMAIL_A, 'not_sent', ADMIN)).status).toBe(409);

    const other = await setup();
    await schedule(other);
    await processDueInvoiceEmails(other, { now: MORNING, deps: deps(vi.fn(async () => ({ ok: false, uncertain: true }))) });
    await resolveUncertainInvoiceEmail(other, INVOICE, EMAIL_A, 'not_sent', ADMIN, { now: MORNING });
    expect(outbox(other)[0]).toMatchObject({ status: 'cancelled', cancel_reason: 'resent_after_uncertain' });
    expect((await queueInvoiceEmail(other, INVOICE, { id: EMAIL_B, sendNow: true }, ADMIN, { now: MORNING })).ok).toBe(true);
  });
});

describe('send now', () => {
  it('sends immediately, and a repeated tap does not send twice', async () => {
    const db = await setup();
    const send = accepted();
    await queueInvoiceEmail(db, INVOICE, { id: EMAIL_A, sendNow: true }, ADMIN, { now: NIGHT });
    // Outside working hours is fine when the owner presses Send themselves.
    const first = await sendInvoiceEmailNow(db, INVOICE, EMAIL_A, ADMIN, { now: NIGHT, deps: deps(send) });
    const second = await sendInvoiceEmailNow(db, INVOICE, EMAIL_A, ADMIN, { now: NIGHT, deps: deps(send) });
    expect(first.outcome).toBe('sent');
    expect(second).toMatchObject({ ok: true, outcome: 'sent', replayed: true });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('holds on a definite failure so the owner can try again', async () => {
    const db = await setup();
    await queueInvoiceEmail(db, INVOICE, { id: EMAIL_A, sendNow: true }, ADMIN, { now: NIGHT });
    const failed = await sendInvoiceEmailNow(db, INVOICE, EMAIL_A, ADMIN, { now: NIGHT, deps: deps(vi.fn(async () => ({ ok: false, uncertain: false, code: 'EAUTH' }))) });
    expect(failed.outcome).toBe('held');
    const send = accepted();
    const retried = await sendInvoiceEmailNow(db, INVOICE, EMAIL_A, ADMIN, { now: NIGHT, deps: deps(send) });
    expect(retried.outcome).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a held email with the balance the owner now sees, but never for a replaced invoice', async () => {
    const db = await setup();
    await schedule(db);
    Object.assign(invoice(db), { payment_status: 'partially_paid', amount_due: 155 });
    await processDueInvoiceEmails(db, { now: MORNING, deps: deps(accepted()) });
    expect(outbox(db)[0].status).toBe('held');

    const send = accepted();
    const sent = await sendInvoiceEmailNow(db, INVOICE, EMAIL_A, ADMIN, { now: MORNING, deps: deps(send) });
    expect(sent.outcome).toBe('sent');
    expect(outbox(db)[0].expected_amount_due).toBe(155);

    const replaced = await setup();
    await schedule(replaced);
    invoice(replaced).superseded_by_invoice_id = EMAIL_B;
    const blocked = await sendInvoiceEmailNow(replaced, INVOICE, EMAIL_A, ADMIN, { now: MORNING, deps: deps(send) });
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('queue view and worker secret', () => {
  it('lists open emails with their invoice number, and no closed ones', async () => {
    const db = await setup();
    await schedule(db);
    const listed = await listOpenInvoiceEmails(db);
    expect(listed.emails).toHaveLength(1);
    expect(listed.emails[0]).toMatchObject({ status: 'scheduled', invoiceNumber: 'VVE-INV-2026-000900', customerName: 'Sample Customer' });
    await cancelInvoiceEmail(db, INVOICE, EMAIL_A);
    expect((await listOpenInvoiceEmails(db)).emails).toHaveLength(0);
  });

  describe('worker secret', () => {
    beforeEach(() => vi.stubEnv('INVOICE_EMAIL_WORKER_SECRET', 'synthetic-worker-secret-0123456789abcdef'));
    afterEach(() => vi.unstubAllEnvs());
    const req = (authorization) => ({ headers: authorization ? { authorization } : {} });

    it('accepts only the exact secret', () => {
      expect(isInvoiceEmailWorker(req('Bearer synthetic-worker-secret-0123456789abcdef'))).toBe(true);
      expect(isInvoiceEmailWorker(req('Bearer synthetic-worker-secret-0123456789abcdeX'))).toBe(false);
      expect(isInvoiceEmailWorker(req('Bearer short'))).toBe(false);
      expect(isInvoiceEmailWorker(req())).toBe(false);
    });

    it('is closed when no secret, or a short one, is configured', () => {
      vi.stubEnv('INVOICE_EMAIL_WORKER_SECRET', 'too-short');
      expect(isInvoiceEmailWorker(req('Bearer too-short'))).toBe(false);
      vi.stubEnv('INVOICE_EMAIL_WORKER_SECRET', '');
      expect(isInvoiceEmailWorker(req('Bearer '))).toBe(false);
    });
  });
});
