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

// Covers admin/api/invoices/[id].js — an ordinary single dynamic segment
// (no ellipsis), the same shape as the long-proven
// admin/api/bookings/[id].js. Actions are dispatched via a `?action=` query
// string parameter, never additional path segments.
//
// This replaced two prior catch-all-based shapes
// (admin/api/invoices/[id]/[[...action]].js, then
// admin/api/invoices/[...segments].js) after a real deployed request
// confirmed Vercel's router does not honour `[...x]`/`[[...x]]` ellipsis
// syntax on this project at all — it treats the entire bracket interior
// (dots included) as the literal name of an ordinary exactly-one-segment
// parameter. Confirmed via: (1) a real deployed req.query key of literal
// `'...segments'` (a string, never the array a genuine catch-all always
// produces), and (2) a real deployed two-segment request
// (/api/invoices/:id/preview) returning a platform 404 with zero log
// output, proving Vercel's own router rejected it before this code ever
// ran. Query-string actions are immune to this entirely, since query
// strings are never part of Vercel's file-system path matching. See
// admin/INVOICES_SETUP.md for the full history.
const { default: handler } = await import('../../../api/invoices/[id].js');
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

// `query`, when provided, is attached directly as req.query — simulating
// what Vercel populates for a plain [id].js dynamic segment (req.query.id,
// a bare string — the same shape admin/api/bookings/[id].js has relied on
// successfully since before this feature existed). Every test that omits
// `query` instead exercises extractIdParam()'s manual req.url-parsing
// fallback.
function makeReq({
  url, bodyObj, headers = { authorization: 'Bearer t' }, method = 'GET', query,
} = {}) {
  const raw = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    method,
    url,
    headers,
    query,
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

describe('/api/invoices/:id[?action=] dispatcher', () => {
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
    getServiceClientMock.mockReturnValue(createFakeSupabase());
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

  it('GET detail returns the invoice with items and payments (draft invoices open by UUID, before an invoice number exists)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(invoiceId);
    expect(body.invoiceNumber).toBeFalsy(); // draft: no number allocated yet
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

  it('POST ?action=issue allocates a number and marks the invoice issued', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=issue`, method: 'POST' }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invoiceNumber).toMatch(/^VVE-INV-\d{4}-013245$/);
  });

  it('POST ?action=issue on an already-issued invoice returns 409', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=issue`, method: 'POST' }), res);
    expect(res.statusCode).toBe(409);
  });

  it('POST ?action=void requires a reason and voids the invoice', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const missingReason = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=void`, method: 'POST', bodyObj: {} }), missingReason);
    expect(missingReason.statusCode).toBe(400);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=void`, method: 'POST', bodyObj: { reason: 'Cancelled' } }), res);
    expect(res.statusCode).toBe(200);
  });

  it('POST ?action=duplicate creates a new draft', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=duplicate`, method: 'POST' }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.invoiceId).not.toBe(invoiceId);
  });

  it('POST ?action=payments records a payment and returns the recalculated balance (£310 total, £30 deposit applied, £280 due before this payment)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, {
      items: [{ description: 'Deep clean', quantity: 1, unitPrice: 310 }],
      depositApplied: 30,
    });
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const detailRes = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}` }), detailRes);
    const detail = JSON.parse(detailRes.body);
    expect(detail.total).toBe(310);
    expect(detail.depositApplied).toBe(30);
    expect(detail.amountDue).toBe(280);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`,
      method: 'POST',
      bodyObj: { amount: 280, paymentDate: '2026-07-16', method: 'card' },
    }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.paymentStatus).toBe('paid');
    expect(body.amountDue).toBe(0);
    expect(body.receiptId).toBeTruthy(); // createReceiptIfPaid was wired through and fired
  });

  it('POST ?action=paymentsReverse&paymentId=... reverses a payment', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const paymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`,
      method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), paymentRes);
    const { paymentId } = JSON.parse(paymentRes.body);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=paymentsReverse&paymentId=${paymentId}`,
      method: 'POST',
      bodyObj: { reason: 'Bounced' },
    }), res);
    expect(res.statusCode).toBe(200);
  });

  it('GET ?action=events returns the audit trail', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=events` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results.map((e) => e.eventType)).toEqual(['issued', 'created']);
  });

  it('an unknown ?action= value returns 404', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=bogus-action`, method: 'POST' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('rejects unauthenticated requests before touching the database', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${VALID_UUID}?action=issue`, method: 'POST' }), res);
    expect(res.statusCode).toBe(401);
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });

  it('GET ?action=preview streams a PDF for a draft, with a DRAFT watermark, and logs a previewed event', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=preview` }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('previewed');
  });

  it('GET ?action=preview returns 400 for an invoice with no line items', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    supabase._tables.invoice_items = supabase._tables.invoice_items.filter((i) => i.invoice_id !== invoiceId);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=preview` }), res);
    expect(res.statusCode).toBe(400);
  });

  it('GET ?action=download on a draft is rejected (only an issued invoice has a final PDF)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=download` }), res);
    expect(res.statusCode).toBe(409);
  });

  it('GET ?action=download on an issued invoice returns a signed URL and logs a downloaded event', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1'); // no PDF generator injected here — download must generate on the fly

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=download` }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toMatch(/^https:\/\/fake-storage\.test\/financial-documents\/invoices\//);

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.pdf_storage_path).toBeTruthy(); // generated and saved on first download

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('downloaded');
  });

  it('POST ?action=issue generates and stores a PDF automatically (download reuses it rather than regenerating)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=issue`, method: 'POST' }), makeRes());
    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.pdf_storage_path).toBe(`invoices/${invoiceId}/invoice-v1.pdf`);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=download` }), res);
    expect(res.statusCode).toBe(200);
  });

  it('POST ?action=send emails the invoice to its stored customer_email and marks it sent', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
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

  it('POST ?action=send allows overriding the recipient via body.to without changing the stored customer_email', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: { to: 'override@example.com' } }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].to).toBe('override@example.com');

    const invoice = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(invoice.customer_email).toBe('jane@example.com'); // unchanged
  });

  it('POST ?action=send defaults to invoiceRecipientEmail over the billing customer_email when no body.to override is given', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { invoiceRecipientEmail: 'agency@example.com' });
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].to).toBe('agency@example.com');
  });

  it('POST ?action=resend logs a "resent" event rather than "sent"', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), makeRes());
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=resend`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId && (e.event_type === 'sent' || e.event_type === 'resent'));
    expect(events.map((e) => e.event_type)).toEqual(['sent', 'resent']);
  });

  it('rejects sending a draft invoice', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(409);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid override recipient', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: { to: 'not-an-email' } }), res);
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
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
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
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(500);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('POST ?action=send is blocked once the invoice is fully paid — send the receipt instead', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }] });
    await issueInvoice(supabase, invoiceId, 'admin-1');
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), makeRes());

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toMatch(/send the receipt instead/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('POST ?action=send mentions the service (first line item) in the email body', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'End of tenancy deep clean', quantity: 1, unitPrice: 100 }] });
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=send`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].html).toContain('End of tenancy deep clean');
  });

  it('POST ?action=remind sends the payment-reminder email with the original issued PDF and logs reminder_sent', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'Deep clean', quantity: 1, unitPrice: 310 }], depositApplied: 30 });
    await issueInvoice(supabase, invoiceId, 'admin-1');
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), makeRes());

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=remind`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].subject).toMatch(/reminder/i);
    expect(sendMailMock.mock.calls[0][0].attachments[0].contentType).toBe('application/pdf');

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('reminder_sent');
  });

  it('POST ?action=remind is rejected once the balance is zero', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }] });
    await issueInvoice(supabase, invoiceId, 'admin-1');
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), makeRes());

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=remind`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(409);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('POST ?action=remind is rejected for a draft invoice', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=remind`, method: 'POST', bodyObj: {} }), res);
    expect(res.statusCode).toBe(409);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('POST ?action=paymentAck sends the acknowledgement email for a partial payment and logs payment_ack_sent', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'Deep clean', quantity: 1, unitPrice: 310 }], depositApplied: 30 });
    await issueInvoice(supabase, invoiceId, 'admin-1');
    const paymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), paymentRes);
    const { paymentId, paymentStatus } = JSON.parse(paymentRes.body);
    expect(paymentStatus).toBe('partially_paid');

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=paymentAck`, method: 'POST', bodyObj: { paymentId } }), res);
    expect(res.statusCode).toBe(200);
    expect(sendMailMock.mock.calls[0][0].html).toContain('£100.00');
    expect(sendMailMock.mock.calls[0][0].attachments).toBeUndefined(); // no receipt exists yet

    const events = supabase._tables.invoice_events.filter((e) => e.document_id === invoiceId);
    expect(events.map((e) => e.event_type)).toContain('payment_ack_sent');
  });

  it('POST ?action=paymentAck is rejected once the invoice is fully paid', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'Deep clean', quantity: 1, unitPrice: 100 }] });
    await issueInvoice(supabase, invoiceId, 'admin-1');
    const paymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), paymentRes);
    const { paymentId } = JSON.parse(paymentRes.body);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=paymentAck`, method: 'POST', bodyObj: { paymentId } }), res);
    expect(res.statusCode).toBe(409);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('POST ?action=paymentAck rejects a paymentId that does not belong to this invoice', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, { items: [{ description: 'Deep clean', quantity: 1, unitPrice: 310 }], depositApplied: 30 });
    await issueInvoice(supabase, invoiceId, 'admin-1');
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), makeRes());

    const otherInvoiceId = await seedDraft(supabase, { items: [{ description: 'Other', quantity: 1, unitPrice: 310 }], depositApplied: 30 });
    await issueInvoice(supabase, otherInvoiceId, 'admin-1');
    const otherPaymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${otherInvoiceId}?action=payments`, method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
    }), otherPaymentRes);
    const { paymentId: otherPaymentId } = JSON.parse(otherPaymentRes.body);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}?action=paymentAck`, method: 'POST', bodyObj: { paymentId: otherPaymentId } }), res);
    expect(res.statusCode).toBe(404);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

// This section directly targets the confirmed regression class: real
// Vercel deployments populate req.query.id as a bare string for a plain
// [id].js dynamic segment (the same shape admin/api/bookings/[id].js has
// used successfully in production since before this feature existed) —
// extractIdParam() prefers req.query.id when present, only falling back to
// manual URL parsing when it's absent. Every test above omits `query` and
// so only exercises the URL-parsing fallback; these tests instead
// construct req.query.id directly, and use real ?action=/&paymentId=
// query-string parameters (parsed independently via req.url, never via
// req.query, so they're unaffected either way) — matching exactly what
// Vercel's own router hands the function at runtime, and exactly the
// frontend's actual request shapes (authFetchBlob: GET, Authorization
// header only, no body; authFetch: POST, Authorization header, no body
// for issue).
describe('Vercel-style query param routing (req.query.id) + exact frontend request shapes', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
  });

  it('loads invoice detail (draft, opened by UUID) when req.query.id is set directly', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}`, query: { id: invoiceId } }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(invoiceId);
    expect(body.documentStatus).toBe('draft');
  });

  it('returns 404 (not 400) when req.query.id carries a well-formed but unknown invoice id', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${VALID_UUID}`, query: { id: VALID_UUID } }), res);
    expect(res.statusCode).toBe(404);
  });

  it('dispatches ?action=issue with req.query.id set, matching authFetch\'s exact request shape (POST, Authorization header, no body)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=issue`, method: 'POST', query: { id: invoiceId },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).invoiceNumber).toMatch(/^VVE-INV-\d{4}-013245$/);
  });

  it('dispatches ?action=preview with req.query.id set, matching authFetchBlob\'s exact request shape (GET, Authorization header only, no body)', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=preview`, method: 'GET', query: { id: invoiceId },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('preserves £340 total / £30 deposit / £310 due through both Preview PDF and Issue invoice, using the exact frontend request shapes for each', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase, {
      items: [{ description: 'Deep clean', quantity: 1, unitPrice: 340 }],
      depositApplied: 30,
    });

    // Preview first (authFetchBlob shape) — must succeed, and the invoice
    // must remain a draft afterwards.
    const previewRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=preview`, method: 'GET', query: { id: invoiceId },
    }), previewRes);
    expect(previewRes.statusCode).toBe(200);
    expect(previewRes.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const stillDraft = supabase._tables.invoices.find((i) => i.id === invoiceId);
    expect(stillDraft.document_status).toBe('draft');
    expect(stillDraft.total).toBe(340);
    expect(stillDraft.deposit_applied).toBe(30);
    expect(stillDraft.amount_due).toBe(310);

    // Then issue (authFetch shape: POST, Authorization header, no body).
    const issueRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=issue`, method: 'POST', query: { id: invoiceId },
    }), issueRes);
    expect(issueRes.statusCode).toBe(200);
    expect(JSON.parse(issueRes.body).invoiceNumber).toMatch(/^VVE-INV-\d{4}-013245$/);

    const detailRes = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}`, query: { id: invoiceId } }), detailRes);
    const detail = JSON.parse(detailRes.body);
    expect(detail.documentStatus).toBe('issued');
    expect(detail.total).toBe(340);
    expect(detail.depositApplied).toBe(30);
    expect(detail.amountDue).toBe(310);
  });

  it('dispatches ?action=paymentsReverse&paymentId=... with req.query.id set', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const paymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=payments`,
      method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
      query: { id: invoiceId },
    }), paymentRes);
    const { paymentId } = JSON.parse(paymentRes.body);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}?action=paymentsReverse&paymentId=${paymentId}`,
      method: 'POST',
      bodyObj: { reason: 'Bounced' },
      query: { id: invoiceId },
    }), res);
    expect(res.statusCode).toBe(200);
  });
});
