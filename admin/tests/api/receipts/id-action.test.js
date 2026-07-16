import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/receipts/[id]/[[...action]].js');
const { createReceiptIfPaid } = await import('../../../api/_lib/receiptLifecycle.js');

function makeRes() {
  const res = {
    statusCode: null, headers: null, body: '',
    writeHead(status, headers) { res.statusCode = status; res.headers = headers; },
    end(body) { res.body = body || ''; },
  };
  return res;
}
function makeReq({ url, headers = { authorization: 'Bearer t' }, method = 'GET' } = {}) {
  return { method, url, headers, on(event, cb) { if (event === 'end') cb(); } };
}

const ADMIN = { ok: true, admin: { id: 'admin-1' } };
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('receipts/[id]/[[...action]] dispatcher', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
  });

  it('rejects an invalid receipt id', async () => {
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
    const { receiptId } = await createReceiptIfPaid(supabase, {
      invoiceId: 'inv-1', customer: { name: 'Jane', email: 'jane@example.com' }, invoiceTotal: 100, totalPaid: 100, paymentDate: '2026-07-16', paymentMethod: 'card',
    }, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}` }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).receiptNumber).toMatch(/^REC-\d{4}-000001$/);
  });

  it('returns receipt event history', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await createReceiptIfPaid(supabase, {
      invoiceId: 'inv-1', customer: { name: 'Jane', email: 'jane@example.com' }, invoiceTotal: 100, totalPaid: 100, paymentDate: '2026-07-16', paymentMethod: 'card',
    }, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/receipts/${receiptId}/events` }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results.map((e) => e.eventType)).toEqual(['receipt_created']);
  });

  it('GET download generates a PDF on the fly if none is stored yet, and returns a signed URL', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const { receiptId } = await createReceiptIfPaid(supabase, {
      invoiceId: 'inv-1', customer: { name: 'Jane', email: 'jane@example.com' }, invoiceTotal: 100, totalPaid: 100, paymentDate: '2026-07-16', paymentMethod: 'card',
    }, 'admin-1'); // no PDF generator injected — download must generate on the fly

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
});
