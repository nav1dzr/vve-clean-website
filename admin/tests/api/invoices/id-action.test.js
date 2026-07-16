import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../_lib/fakeSupabase.js';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();
const sendMailMock = vi.fn();
const isMailerConfiguredMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));
// Never let a test accidentally attempt a real network call to Gmail —
// sendMail/isMailerConfigured are always mocked, same rationale as the
// public-site webhook tests never sending real email.
vi.mock('../../../api/_lib/mailer.js', () => ({
  sendMail: (...args) => sendMailMock(...args),
  isMailerConfigured: (...args) => isMailerConfiguredMock(...args),
}));

const { default: handler } = await import('../../../api/invoices/[id]/[[...action]].js');
const { createDraftInvoice, issueInvoice } = await import('../../../api/_lib/invoiceLifecycle.js');

function makeRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: '',
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

async function seedDraft(supabase, overrides = {}) {
  const { invoiceId } = await createDraftInvoice(supabase, {
    customer: { name: 'Jane Doe', email: 'jane@example.com' },
    items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }, 'admin-1');
  return invoiceId;
}

describe('invoices/[id]/[[...action]] dispatcher', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    sendMailMock.mockReset();
    isMailerConfiguredMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    isMailerConfiguredMock.mockReturnValue(true);
    sendMailMock.mockResolvedValue({ ok: true, messageId: 'msg-1' });
  });

  it('rejects an invalid invoice id', async () => {
    const res = makeRes();
    await handler(makeReq({ url: '/api/invoices/not-a-uuid' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('GET detail returns 404 for a missing invoice', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${VALID_UUID}` }), res);
    expect(res.statusCode).toBe(404);
  });

  it('GET detail returns the invoice with items and payments', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(invoiceId);
    expect(body.items).toHaveLength(1);
    expect(body.payments).toHaveLength(0);
  });

  it('PATCH updates a draft', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}`,
      method: 'PATCH',
      bodyObj: { customer: { name: 'Jane Doe', email: 'jane@example.com' }, items: [{ description: 'Updated', quantity: 1, unitPrice: 200 }] },
    }), res);
    expect(res.statusCode).toBe(200);
  });

  it('DELETE removes a draft', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}`, method: 'DELETE' }), res);
    expect(res.statusCode).toBe(204);
  });

  it('POST issue allocates a number and marks the invoice issued', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/issue`, method: 'POST' }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invoiceNumber).toMatch(/^INV-\d{4}-000001$/);
  });

  it('POST issue on an already-issued invoice returns 409', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/issue`, method: 'POST' }), res);
    expect(res.statusCode).toBe(409);
  });

  it('POST void requires a reason and voids the invoice', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const missingReason = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/void`, method: 'POST', bodyObj: {} }), missingReason);
    expect(missingReason.statusCode).toBe(400);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/void`, method: 'POST', bodyObj: { reason: 'Cancelled' } }), res);
    expect(res.statusCode).toBe(200);
  });

  it('POST duplicate creates a new draft', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/duplicate`, method: 'POST' }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.invoiceId).not.toBe(invoiceId);
  });

  it('POST payments records a payment and returns the recalculated balance', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}/payments`,
      method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.paymentStatus).toBe('paid');
    expect(body.receiptId).toBeTruthy(); // createReceiptIfPaid was wired through and fired
  });

  it('POST payments/:paymentId/reverse reverses a payment', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const paymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}/payments`,
      method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), paymentRes);
    const { paymentId } = JSON.parse(paymentRes.body);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}/payments/${paymentId}/reverse`,
      method: 'POST',
      bodyObj: { reason: 'Bounced' },
    }), res);
    expect(res.statusCode).toBe(200);
  });

  it('GET events returns the audit trail', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/events` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results.map((e) => e.eventType)).toEqual(['issued', 'created']);
  });

  it('an unknown action segment returns 404', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/bogus-action`, method: 'POST' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('rejects unauthenticated requests before touching the database', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${VALID_UUID}/issue`, method: 'POST' }), res);
    expect(res.statusCode).toBe(401);
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });

  it('GET preview streams a PDF for a draft, with a DRAFT watermark, and logs a previewed event', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/preview` }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('previewed');
  });

  it('GET preview returns 400 for an invoice with no line items', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    supabase._tables.invoice_items = supabase._tables.invoice_items.filter((i) => i.invoice_id !== invoiceId);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/preview` }), res);
    expect(res.statusCode).toBe(400);
  });

  it('GET download on a draft is rejected (only an issued invoice has a final PDF)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/download` }), res);
    expect(res.statusCode).toBe(409);
  });

  it('GET download on an issued invoice returns a signed URL and logs a downloaded event', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1'); // no PDF generator injected here — download must generate on the fly

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/download` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toMatch(/^https:\/\/fake-storage\.test\/financial-documents\/invoices\//);

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.pdf_storage_path).toBeTruthy(); // generated and saved on first download

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('downloaded');
  });

  it('POST issue generates and stores a PDF automatically (download reuses it rather than regenerating)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    await handler(makeReq({ url: `/api/invoices/${invoiceId}/issue`, method: 'POST' }), makeRes());
    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.pdf_storage_path).toBe(`invoices/${invoiceId}/invoice-v1.pdf`);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/download` }), res);
    expect(res.statusCode).toBe(200);
  });

  it('POST send emails the invoice to its stored customer_email and marks it sent', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).to).toBe('jane@example.com');
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe('jane@example.com');
    expect(sendMailMock.mock.calls[0][0].attachments[0].contentType).toBe('application/pdf');

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.sent_at).toBeTruthy();

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('sent');
  });

  it('POST send allows overriding the recipient via body.to without changing the stored customer_email', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: { to: 'override@example.com' } }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].to).toBe('override@example.com');

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.customer_email).toBe('jane@example.com'); // unchanged
  });

  it('POST send defaults to invoiceRecipientEmail over the billing customer_email when no body.to override is given', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { invoiceRecipientEmail: 'agency@example.com' });
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].to).toBe('agency@example.com');
  });

  it('POST resend logs a "resent" event rather than "sent"', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: {} }), makeRes());
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/resend`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId && (e.event_type === 'sent' || e.event_type === 'resent'));
    expect(events.map((e) => e.event_type)).toEqual(['sent', 'resent']);
  });

  it('rejects sending a draft invoice', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(409);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid override recipient', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: { to: 'not-an-email' } }), res);
    expect(res.statusCode).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('logs a send_failed event and returns 502 when the mail provider rejects the message', async () => {
    sendMailMock.mockResolvedValue({ ok: false, error: 'smtp rejected' });
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(502);

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.sent_at).toBeUndefined();

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('send_failed');
  });

  it('returns 500 without attempting to send when the mailer is not configured', async () => {
    isMailerConfiguredMock.mockReturnValue(false);
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}/send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(500);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
