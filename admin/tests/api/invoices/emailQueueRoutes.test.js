import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';
import { getBusinessSettings } from '../../../api/_lib/businessSettings.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();
const sendMailMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));
// Mail is always a stub: no test can reach Gmail.
vi.mock('../../../api/_lib/mailer.js', () => ({
  sendMail: (...args) => sendMailMock(...args),
  isMailerConfigured: () => true,
}));

const { default: listHandler } = await import('../../../api/invoices/index.js');
const { default: detailHandler } = await import('../../../api/invoices/[id].js');

const SECRET = 'synthetic-worker-secret-0123456789abcdef';
const INVOICE = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PDF_PATH = `invoices/${INVOICE}/invoice-v1.pdf`;

function makeRes() {
  const res = { statusCode: null, body: '', writeHead(status) { res.statusCode = status; }, end(body) { res.body = body || ''; } };
  return res;
}
function makeReq({ url, method = 'GET', headers = { authorization: 'Bearer admin-token' }, bodyObj } = {}) {
  const raw = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return { url, method, headers, on(event, cb) { if (event === 'data' && raw) cb(Buffer.from(raw)); if (event === 'end') cb(); } };
}
async function seed() {
  const db = createFakeSupabase({
    invoices: [{
      id: INVOICE, invoice_number: 'VVE-INV-2026-000900', document_status: 'issued', payment_status: 'unpaid', document_version: 1,
      total: 285, deposit_applied: 30, amount_paid: 0, amount_due: 255, customer_name: 'Sample Customer',
      customer_email: 'customer@example.invalid', payment_option: 'bank_transfer', business_snapshot: getBusinessSettings(),
      pdf_storage_path: PDF_PATH, sent_at: null, superseded_by_invoice_id: null,
    }],
    invoice_items: [{ id: 'item-1', invoice_id: INVOICE, description: 'Clean', quantity: 1, unit_price: 285, line_discount: 0, line_total: 285, sort_order: 0 }],
  });
  await db.storage.from('financial-documents').upload(PDF_PATH, Buffer.from('%PDF-synthetic'));
  getServiceClientMock.mockReturnValue(db);
  return db;
}

beforeEach(() => {
  verifyAdminRequestMock.mockReset();
  getServiceClientMock.mockReset();
  sendMailMock.mockReset();
  verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
  sendMailMock.mockResolvedValue({ ok: true, messageId: 'synthetic-id' });
  vi.stubEnv('INVOICE_EMAIL_WORKER_SECRET', SECRET);
  vi.stubEnv('INVOICE_EMAIL_QUEUE_ENABLED', 'true');
  vi.stubEnv('VERCEL_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/invoices?action=process-scheduled (scheduler entry point)', () => {
  const run = (headers, method = 'POST') => {
    const res = makeRes();
    return listHandler(makeReq({ url: '/api/invoices?action=process-scheduled', method, headers, bodyObj: {} }), res).then(() => res);
  };

  it('refuses a missing secret, a wrong secret, an admin login and a GET', async () => {
    await seed();
    expect((await run({})).statusCode).toBe(401);
    expect((await run({ authorization: 'Bearer wrong-secret-wrong-secret-wrong-secret' })).statusCode).toBe(401);
    expect((await run({ authorization: 'Bearer admin-token' })).statusCode).toBe(401);
    expect((await run({ authorization: `Bearer ${SECRET}` }, 'GET')).statusCode).toBe(401);
    expect(verifyAdminRequestMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends nothing while the feature is switched off', async () => {
    const db = await seed();
    db._tables.invoice_email_outbox = [{ id: EMAIL, invoice_id: INVOICE, status: 'scheduled', attempts: 0, recipient: 'customer@example.invalid', expected_document_version: 1, expected_amount_due: 255, scheduled_for: '2020-01-01T08:00:00.000Z', next_attempt_at: '2020-01-01T08:00:00.000Z' }];
    vi.stubEnv('INVOICE_EMAIL_QUEUE_ENABLED', 'false');
    const res = await run({ authorization: `Bearer ${SECRET}` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'disabled' });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(db._tables.invoice_email_outbox[0].status).toBe('scheduled');
  });

  it('runs with the right secret and reports counts only', async () => {
    await seed();
    const res = await run({ authorization: `Bearer ${SECRET}` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok', processed: 0, sent: 0 });
  });
});

describe('/api/invoices/:id?action=emailQueue (owner actions)', () => {
  const post = (bodyObj) => {
    const res = makeRes();
    return detailHandler(makeReq({ url: `/api/invoices/${INVOICE}?action=emailQueue`, method: 'POST', bodyObj }), res).then(() => res);
  };

  it('is unavailable while switched off, and the invoice page falls back to ordinary Send', async () => {
    await seed();
    vi.stubEnv('INVOICE_EMAIL_QUEUE_ENABLED', 'false');
    expect((await post({ op: 'sendNow', id: EMAIL })).statusCode).toBe(503);
    const detail = makeRes();
    await detailHandler(makeReq({ url: `/api/invoices/${INVOICE}` }), detail);
    expect(JSON.parse(detail.body).emailQueueEnabled).toBeUndefined();
  });

  it('requires an admin login', async () => {
    await seed();
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    expect((await post({ op: 'sendNow', id: EMAIL })).statusCode).toBe(401);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends now once, even when the same request arrives twice', async () => {
    const db = await seed();
    const first = await post({ op: 'sendNow', id: EMAIL });
    const second = await post({ op: 'sendNow', id: EMAIL });
    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body)).toMatchObject({ ok: true, outcome: 'sent' });
    expect(second.statusCode).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(db._tables.invoices[0].sent_at).toBeTruthy();
  });

  it('reports an unconfirmed send as a warning, not a failure to retry', async () => {
    await seed();
    sendMailMock.mockResolvedValue({ ok: false, uncertain: true, code: 'ETIMEDOUT' });
    const res = await post({ op: 'sendNow', id: EMAIL });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.outcome).toBe('uncertain');
    expect(body.warning).toMatch(/Check Sent mail/);
  });

  it('shows the queue on the invoice and rejects unknown actions', async () => {
    await seed();
    await post({ op: 'sendNow', id: EMAIL });
    const detail = makeRes();
    await detailHandler(makeReq({ url: `/api/invoices/${INVOICE}` }), detail);
    const body = JSON.parse(detail.body);
    expect(body.emailQueueEnabled).toBe(true);
    expect(body.emailQueue[0]).toMatchObject({ id: EMAIL, status: 'sent', recipient: 'customer@example.invalid' });
    expect((await post({ op: 'delete-everything', id: EMAIL })).statusCode).toBe(400);
  });
});
