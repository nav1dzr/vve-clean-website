import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();
const sendMailMock = vi.fn();
const isMailerConfiguredMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));
vi.mock('../../../api/_lib/mailer.js', () => ({
  sendMail: (...args) => sendMailMock(...args),
  isMailerConfigured: (...args) => isMailerConfiguredMock(...args),
}));

// Covers admin/api/receipts/[[...segments]].js — the single dispatcher that
// replaced the earlier admin/api/receipts/index.js +
// admin/api/receipts/[id]/[[...action]].js pair (see that file's header
// comment for why: freeing a function slot for admin/api/customers/
// [[...segments]].js within the admin Vercel project's 12-function
// budget). Every assertion below is carried over unchanged from the two
// files it replaces — only the import path and "no id segment" list-route
// tests are new.
const { default: handler } = await import('../../../api/receipts/[[...segments]].js');
const { createReceiptIfPaid } = await import('../../../api/_lib/receiptLifecycle.js');

function makeRes() {
  const res = {
    statusCode: null, headers: null, body: '',
    writeHead(status, headers) { res.statusCode = status; res.headers = headers; },
    end(body) { res.body = body || ''; },
  };
  return res;
}
function makeReq({ url, bodyObj, headers = { authorization: 'Bearer t' }, method = 'GET' } = {}) {
  const raw = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    method,
    url,
    headers,
    on(event, cb) {
      if (event === 'data' && raw) cb(Buffer.from(raw));
      if (event === 'end') cb();
    },
  };
}

const ADMIN = { ok: true, admin: { id: 'admin-1' } };
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

async function seedReceipt(supabase, overrides = {}) {
  return createReceiptIfPaid(supabase, {
    invoiceId: 'inv-1',
    customer: { name: 'Jane', email: 'jane@example.com' },
    invoiceTotal: 100,
    totalPaid: 100,
    paymentDate: '2026-07-16',
    paymentMethod: 'card',
    ...overrides,
  }, 'admin-1');
}

describe('GET /api/receipts (list)', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-GET methods (no POST — receipts are never created directly)', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts', method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('lists receipts', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    const supabase = createFakeSupabase({
      receipts: [{ id: 'r-1', receipt_number: 'REC-2026-000001', customer_name: 'Jane', total_paid: 100, payment_date: '2026-07-16', created_at: '2026-07-16T00:00:00Z' }],
    });
    getServiceClientMock.mockReturnValue(supabase);
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts' }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results).toHaveLength(1);
  });

  it('rejects an invalid invoiceId filter', async () => {
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts?invoiceId=not-a-uuid' }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('/api/receipts/:id[/action] dispatcher', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    sendMailMock.mockReset();
    isMailerConfiguredMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    isMailerConfiguredMock.mockReturnValue(true);
    sendMailMock.mockResolvedValue({ ok: true, messageId: 'msg-1' });
  });

  it('rejects an invalid receipt id', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: '/api/receipts/not-a-uuid' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for a missing receipt', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${VALID_UUID}` }), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns receipt detail', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}` }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).receiptNumber).toMatch(/^REC-\d{4}-000001$/);
  });

  it('returns receipt event history', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/events` }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results.map((e) => e.eventType)).toEqual(['receipt_created']);
  });

  it('GET download generates a PDF on the fly if none is stored yet, and returns a signed URL', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase); // no PDF generator injected — download must generate on the fly

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/download` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toMatch(/^https:\/\/fake-storage\.test\/financial-documents\/receipts\//);

    const receipt = supabase._tables.receipts.find((r) => r.id === receiptId);
    expect(receipt.pdf_storage_path).toBeTruthy();
  });

  it('GET download returns 404 for a missing receipt', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${VALID_UUID}/download` }), res);
    expect(res.statusCode).toBe(404);
  });

  it('POST send emails the receipt to its stored customer_email and marks it sent', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].to).toBe('jane@example.com');
    expect(sendMailMock.mock.calls[0][0].attachments[0].contentType).toBe('application/pdf');

    const receipt = supabase._tables.receipts.find((r) => r.id === receiptId);
    expect(receipt.sent_at).toBeTruthy();

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === receiptId);
    expect(events.map((e) => e.event_type)).toContain('sent');
  });

  it('POST resend logs a "resent" event', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase);

    await handler(makeReq({ url: `/api/receipts/${receiptId}/send`, method: 'POST', bodyObj: {} }), makeRes());
    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/resend`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === receiptId && (e.event_type === 'sent' || e.event_type === 'resent'));
    expect(events.map((e) => e.event_type)).toEqual(['sent', 'resent']);
  });

  it('rejects an invalid override recipient', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/send`, method: 'POST', bodyObj: { to: 'not-an-email' } }), res);
    expect(res.statusCode).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('logs a send_failed event and returns 502 when the mail provider rejects the message', async () => {
    sendMailMock.mockResolvedValue({ ok: false, error: 'smtp rejected' });
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(502);

    const receipt = supabase._tables.receipts.find((r) => r.id === receiptId);
    expect(receipt.sent_at).toBeUndefined();
  });

  it('a receipt whose invoice set receiptRecipientEmail is sent there by default', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await seedReceipt(supabase, { recipientEmailOverride: 'landlord@example.com' });

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].to).toBe('landlord@example.com');
  });
});
