import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, db, sendMail } = vi.hoisted(() => ({ auth: vi.fn(), db: { rpc: vi.fn() }, sendMail: vi.fn() }));
vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: auth }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: () => db }));
vi.mock('../../../api/_lib/mailer.js', () => ({ sendMail, isMailerConfigured: () => true }));

const { default: handler } = await import('../../../api/invoices/[id].js');
const invoiceId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const input = {
  operationId: '33333333-3333-4333-8333-333333333333', sourcePaymentId: 'fixture-balance',
  expectedInvoiceUpdatedAt: '2026-11-04T12:00:00.123456Z', expectedJourneyRevision: 7,
  depositReviewed: true, reviewedSource: true, method: 'bank_transfer',
  paymentDate: '2026-11-04', reason: 'Reviewed original payment',
};
const saved = {
  allocationId: '44444444-4444-4444-8444-444444444444',
  paymentId: '55555555-5555-4555-8555-555555555555',
  receiptId: '66666666-6666-4666-8666-666666666666',
  amountDue: 0, amountPaid: 120, paymentStatus: 'paid', replayed: false,
};
async function request(method, body, suffix = '') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = '/api/invoices/' + invoiceId + '?action=bookingPaymentAllocation' + suffix;
  req.query = { id: invoiceId };
  req.headers = { authorization: 'Bearer fixture' };
  const res = {
    writeHead(status) { this.status = status; },
    end(text) { this.body = JSON.parse(text); },
  };
  await handler(req, res);
  return res;
}

beforeEach(() => {
  auth.mockReset();
  auth.mockResolvedValue({ ok: true, admin: { id: adminId } });
  db.rpc.mockReset();
  sendMail.mockReset();
  vi.stubEnv('BOOKING_INVOICE_ALLOCATION_ENABLED', 'true');
});
afterEach(() => {
  expect(sendMail).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});

describe('existing booking payment allocation API', () => {
  it('requires authenticated admin access before reading or writing', async () => {
    auth.mockResolvedValue({ ok: false, status: 401, error: 'Sign in' });
    expect((await request('POST', input)).status).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('keeps the feature off by default', async () => {
    vi.stubEnv('BOOKING_INVOICE_ALLOCATION_ENABLED', undefined);
    expect((await request('GET')).status).toBe(503);
    expect((await request('POST', input)).status).toBe(503);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('requires deliberate source confirmation before calling the transaction', async () => {
    const result = await request('POST', { ...input, reviewedSource: false });
    expect(result.body).toMatchObject({ ok: false, outcome: 'not_applied' });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('passes exact source identity and versions, never a browser-supplied amount', async () => {
    db.rpc.mockResolvedValue({ data: saved });
    const result = await request('POST', { ...input, amount: 99999 });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, ...saved });
    expect(db.rpc).toHaveBeenCalledOnce();
    expect(db.rpc).toHaveBeenCalledWith('apply_booking_invoice_allocation', {
      p_invoice_id: invoiceId, p_source_payment_external_id: input.sourcePaymentId,
      p_operation_id: input.operationId, p_expected_invoice_updated_at: input.expectedInvoiceUpdatedAt,
      p_expected_journey_revision: 7, p_deposit_reviewed: true, p_payment_method: 'bank_transfer',
      p_payment_date: input.paymentDate, p_review_reason: input.reason, p_admin_id: adminId,
    });
  });

  it('returns a definite stale rejection for refresh, but preserves an uncertain attempt', async () => {
    db.rpc.mockResolvedValueOnce({ error: { message: 'allocation_stale', code: '40001' } });
    expect((await request('POST', input)).body).toMatchObject({ ok: false, outcome: 'not_applied' });
    db.rpc.mockRejectedValueOnce(new Error('fixture response lost'));
    expect((await request('POST', input)).body).toMatchObject({ ok: false, outcome: 'unknown' });
    db.rpc.mockResolvedValueOnce({ error: { message: 'allocation_operation_conflict', code: '40001' } });
    expect((await request('POST', input)).body).toMatchObject({ ok: false, outcome: 'needs_review' });
  });

  it.each([null, '', -1, 'invalid'])('keeps malformed result amounts unresolved (%s)', async (amountPaid) => {
    db.rpc.mockResolvedValue({ data: { ...saved, amountPaid } });
    expect((await request('POST', input)).body).toMatchObject({ ok: false, outcome: 'unknown' });
  });

  it('looks up a saved result by operation without invoking the write RPC', async () => {
    db.rpc.mockResolvedValueOnce({ data: { ...saved, replayed: true } });
    const result = await request('GET', undefined, '&operationId=' + input.operationId);
    expect(result.body).toMatchObject({ ok: true, replayed: true, receiptId: saved.receiptId });
    expect(db.rpc).toHaveBeenCalledOnce();
    expect(db.rpc).toHaveBeenCalledWith('booking_invoice_allocation_snapshot', {
      p_invoice_id: invoiceId, p_admin_id: adminId, p_operation_id: input.operationId,
    });
    db.rpc.mockResolvedValueOnce({ data: null });
    expect((await request('GET', undefined, '&operationId=' + input.operationId)).body)
      .toMatchObject({ ok: false, outcome: 'unknown' });
  });
});
