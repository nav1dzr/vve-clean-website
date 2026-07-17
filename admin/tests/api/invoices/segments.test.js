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

// Covers admin/api/invoices/[...segments].js — a REQUIRED catch-all
// (single bracket, "...segments", 1+ path segments), handling
// /api/invoices/:id and every /api/invoices/:id/<action...> route.
// List/create (GET/POST /api/invoices, zero segments) is a *separate*,
// ordinary admin/api/invoices/index.js file — see index.test.js — never
// this one.
//
// This replaced an earlier admin/api/invoices/[[...segments]].js (an
// OPTIONAL catch-all folding list/create and detail/actions into one
// file), which regressed GET /api/invoices (the list route, zero segments)
// to a hard "Request failed" once deployed. That, plus the original
// pre-existing bug where GET /api/invoices/:id (an invoice id with zero
// further action segments, under the even-earlier nested
// admin/api/invoices/[id]/[[...action]].js) 404'd despite the invoice
// genuinely existing, both point at the same underlying cause: this
// Vercel project's routing does not reliably match an optional catch-all
// file when the catch-all portion is itself empty. A required catch-all
// never has that ambiguity — Vercel simply won't route a zero-segment
// request to this file at all, by definition — which is why list/create
// now lives in a plain literal index.js instead of sharing this file.
const { default: handler } = await import('../../../api/invoices/[...segments].js');
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
// exactly what Vercel populates for a [...segments] required catch-all (an
// array of path segments after the fixed /api/invoices/ prefix), rather
// than relying on extractSegments()'s manual req.url-parsing fallback that
// every other test below exercises (query omitted).
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

describe('/api/invoices/:id[/action] dispatcher', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    sendMailMock.mockReset();
    isMailerConfiguredMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
    isMailerConfiguredMock.mockReturnValue(true);
    sendMailMock.mockResolvedValue({ ok: true, messageId: 'msg-1' });
  });

  it('rejects an invalid invoice id (degrades gracefully rather than crashing, even though Vercel should never route zero segments here)', async () => {
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

  it('POST payments records a payment and returns the recalculated balance (£310 total, £30 deposit applied, £280 due before this payment)', async () => {
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
      url: `/api/invoices/${invoiceId}/payments`,
      method: 'POST',
      bodyObj: { amount: 280, paymentDate: '2026-07-16', method: 'card' },
    }), res);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.paymentStatus).toBe('paid');
    expect(body.amountDue).toBe(0);
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

// This section directly targets the regression class: real Vercel
// deployments populate req.query.segments (an array of path segments) for
// a [...segments].js catch-all, rather than leaving handlers to parse
// req.url themselves — extractSegments() prefers req.query when present,
// only falling back to manual URL parsing when it's absent (see
// admin/api/_lib/routeParams.js). Every test above omits `query` and so
// only exercises the URL-parsing fallback; these tests instead construct
// req.query.segments directly, matching what Vercel's own router actually
// hands the function at runtime — always 1+ elements for this file, since
// it's a *required* catch-all (Vercel never routes a zero-segment request
// here at all; that's index.js's job).
describe('Vercel-style query param routing (req.query.segments, always 1+ elements)', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
    verifyAdminRequestMock.mockResolvedValue(ADMIN);
  });

  it('loads invoice detail (draft, opened by UUID) when req.query.segments is a one-element array', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}`, query: { segments: [invoiceId] } }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(invoiceId);
    expect(body.documentStatus).toBe('draft');
  });

  it('returns 404 (not 400) when req.query.segments carries a well-formed but unknown invoice id', async () => {
    getServiceClientMock.mockReturnValue(createFakeSupabase());
    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${VALID_UUID}`, query: { segments: [VALID_UUID] } }), res);
    expect(res.statusCode).toBe(404);
  });

  it('dispatches a single-segment action (issue) when req.query.segments is a two-element array', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}/issue`, method: 'POST', query: { segments: [invoiceId, 'issue'] },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).invoiceNumber).toMatch(/^INV-\d{4}-000001$/);
  });

  it('dispatches the nested payments/:paymentId/reverse action when req.query.segments is a four-element array', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);
    await issueInvoice(supabase, invoiceId, 'admin-1');

    const paymentRes = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}/payments`,
      method: 'POST',
      bodyObj: { amount: 100, paymentDate: '2026-07-16', method: 'card' },
      query: { segments: [invoiceId, 'payments'] },
    }), paymentRes);
    const { paymentId } = JSON.parse(paymentRes.body);

    const res = makeRes();
    await handler(makeReq({
      url: `/api/invoices/${invoiceId}/payments/${paymentId}/reverse`,
      method: 'POST',
      bodyObj: { reason: 'Bounced' },
      query: { segments: [invoiceId, 'payments', paymentId, 'reverse'] },
    }), res);
    expect(res.statusCode).toBe(200);
  });

  it('still resolves correctly if Vercel ever supplies a bare string instead of a one-element array for a single segment', async () => {
    const supabase = createFakeSupabase();
    getServiceClientMock.mockReturnValue(supabase);
    const invoiceId = await seedDraft(supabase);

    const res = makeRes();
    await handler(makeReq({ url: `/api/invoices/${invoiceId}`, query: { segments: invoiceId } }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe(invoiceId);
  });
});
