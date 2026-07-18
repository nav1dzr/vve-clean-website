import { describe, it, expect, vi, beforeEach } from 'vitest';

// Full-handler integration tests for the three post-payment concerns added
// to api/stripe-webhook.js in this pass:
//   Task 1 — automatic customer find/create for genuinely paid bookings
//   Task 2 — best-effort Stripe session metadata sync after a booking_ref
//            collision retry
//   Task 3 — completeness of the fields the webhook's own fallback
//            insert/upsert persists when it is the one creating the row
//            (the checkout-time insert never landed)
//
// Uses a small multi-table in-memory fake (processed_stripe_events,
// bookings, customers, invoice_events) covering exactly the chain shapes
// stripe-webhook.js and api/_lib/customerSync.js issue against Supabase —
// same "purpose-built minimal mock, not the shared fake" convention as
// tests/api/backfillPaidBooking.test.js and
// tests/api/stripeWebhookBookingRefRetry.test.js (there is no shared fake
// in this project's root tests/, only in admin/tests/).

const constructEventMock = vi.fn();
const sendMailMock       = vi.fn().mockResolvedValue({});
const verifyMock         = vi.fn().mockResolvedValue(true);
const sessionsUpdateMock = vi.fn().mockResolvedValue({});

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: (...args) => constructEventMock(...args) },
    checkout: { sessions: { update: (...args) => sessionsUpdateMock(...args) } },
  })),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      verify:   (...args) => verifyMock(...args),
      sendMail: (...args) => sendMailMock(...args),
    }),
  },
}));

function createFakeSupabase() {
  const tables = { processed_stripe_events: [], bookings: [], customers: [], invoice_events: [] };
  let idCounter = 1;
  const genId = () => `id-${idCounter++}`;

  function from(table) {
    if (!tables[table]) tables[table] = [];
    const rows = tables[table];
    const filters = [];
    let pendingInsert = null;
    let pendingUpdate = null;
    let pendingUpsert = null;

    function matched() { return rows.filter((r) => filters.every((f) => f(r))); }

    async function execute(wantSingle) {
      if (pendingUpsert) {
        const { row, opts } = pendingUpsert;
        const conflictCol = opts?.onConflict;
        const existingByConflict = conflictCol ? rows.find((r) => r[conflictCol] === row[conflictCol]) : null;
        // Simulate bookings.booking_ref's own separate unique constraint —
        // a conflict here is distinct from the onConflict (stripe_session_id)
        // match, exactly the race upsertBookingWithRefRetry exists to retry.
        if (table === 'bookings' && row.booking_ref != null) {
          const refConflict = rows.find((r) => r.booking_ref === row.booking_ref && r !== existingByConflict);
          if (refConflict) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "bookings_booking_ref_key"' } };
          }
        }
        if (existingByConflict) {
          Object.assign(existingByConflict, row);
          return { data: existingByConflict, error: null };
        }
        const inserted = { id: genId(), created_at: new Date().toISOString(), ...row };
        rows.push(inserted);
        return { data: inserted, error: null };
      }
      if (pendingInsert) {
        if (table === 'processed_stripe_events') {
          for (const r of pendingInsert) {
            if (rows.some((x) => x.event_id === r.event_id)) {
              return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "processed_stripe_events_event_id_key"' } };
            }
          }
        }
        const inserted = pendingInsert.map((r) => ({ id: genId(), created_at: new Date().toISOString(), ...r }));
        rows.push(...inserted);
        return { data: wantSingle ? inserted[0] : inserted, error: null };
      }
      if (pendingUpdate) {
        const m = matched();
        m.forEach((r) => Object.assign(r, pendingUpdate));
        return { data: wantSingle ? (m[0] || null) : m, error: null };
      }
      const m = matched();
      return { data: wantSingle ? (m[0] || null) : m, error: null };
    }

    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push((r) => r[col] === val); return builder; },
      or(expr) {
        const clauses = expr.split(',').map((c) => {
          const [col, , ...rest] = c.split('.');
          return { col, value: rest.join('.') };
        });
        filters.push((r) => clauses.some(({ col, value }) => String(r[col]) === value));
        return builder;
      },
      insert(rowOrRows) { pendingInsert = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]; return builder; },
      update(patch) { pendingUpdate = patch; return builder; },
      upsert(row, opts) { pendingUpsert = { row, opts }; return builder; },
      async maybeSingle() { return execute(true); },
      async single() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };

    return builder;
  }

  return { from, _tables: tables };
}

let fakeSupabase;
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => fakeSupabase),
}));

const { default: handler } = await import('../../api/stripe-webhook.js');

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

function makeReq() {
  return {
    method: 'POST',
    headers: { 'stripe-signature': 'test-sig' },
    on(event, cb) {
      if (event === 'data') cb(Buffer.from('{}'));
      if (event === 'end') cb();
    },
  };
}

const VALID_JWT_SERVICE_ROLE =
  'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.sig';

function baseMeta(overrides = {}) {
  return {
    fullName: 'Jane Smith',
    email:    'jane@example.com',
    phone:    '07700900000',
    address:  '1 Test St',
    postcode: 'N15 2NG',
    service:  'End of tenancy',
    price:    '249',
    date:     '2026-08-01',
    time:     'Flexible',
    booking_ref: 'N152NG160726',
    confirmation_token: 'a'.repeat(64),
    terms_accepted: 'true',
    terms_accepted_at: '2026-07-14T10:00:00.000Z',
    terms_version: '2026-07-14',
    cancellation_policy_version: '2026-07-14',
    ...overrides,
  };
}

function makeEvent(eventId, metaOverrides = {}, sessionOverrides = {}) {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_abc',
        payment_intent: 'pi_test_abc',
        payment_status: 'paid',
        metadata: baseMeta(metaOverrides),
        ...sessionOverrides,
      },
    },
  };
}

beforeEach(() => {
  fakeSupabase = createFakeSupabase();
  sendMailMock.mockClear();
  verifyMock.mockClear();
  sessionsUpdateMock.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
  process.env.STRIPE_SECRET_KEY     = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.GMAIL_SENDER          = 'sender@example.com';
  process.env.GMAIL_APP_PASSWORD    = 'app-password';
  process.env.BUSINESS_EMAIL        = 'business@example.com';
  process.env.VITE_SUPABASE_URL          = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY  = VALID_JWT_SERVICE_ROLE;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.GOOGLE_SHEETS_URL;
  delete process.env.GOOGLE_SHEETS_SECRET;
});

describe('stripe-webhook — Task 1: automatic customer sync for paid bookings', () => {
  it('creates a customer for a genuinely paid booking', async () => {
    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = await (async () => { const r = makeRes(); await handler(makeReq(), r); return r; })();

    expect(res.statusCode).toBe(200);
    expect(fakeSupabase._tables.customers).toHaveLength(1);
    expect(fakeSupabase._tables.customers[0]).toMatchObject({
      name: 'Jane Smith', email: 'jane@example.com', phone: '07700900000',
      normalised_email: 'jane@example.com', normalised_phone: '07700900000', source: 'website',
    });
  });

  it('reuses an existing customer matched by normalised email instead of creating a second one', async () => {
    fakeSupabase._tables.customers.push({ id: 'existing-1', normalised_email: 'jane@example.com', normalised_phone: null });
    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(fakeSupabase._tables.customers).toHaveLength(1);
  });

  it('reuses an existing customer matched by normalised phone instead of creating a second one', async () => {
    fakeSupabase._tables.customers.push({ id: 'existing-1', normalised_email: null, normalised_phone: '07700900000' });
    constructEventMock.mockReturnValue(makeEvent('evt_1', { email: '' }));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(fakeSupabase._tables.customers).toHaveLength(1);
  });

  it('safely creates a customer using phone alone when the booking has no email on file', async () => {
    constructEventMock.mockReturnValue(makeEvent('evt_1', { email: '' }));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(fakeSupabase._tables.customers).toHaveLength(1);
    expect(fakeSupabase._tables.customers[0].email).toBeNull();
    expect(fakeSupabase._tables.customers[0].phone).toBe('07700900000');
  });

  it('does not create a second customer when the same Stripe event is delivered twice (idempotent via the event-claim guard)', async () => {
    constructEventMock.mockReturnValue(makeEvent('evt_dup'));

    const res1 = makeRes();
    await handler(makeReq(), res1);
    expect(res1.statusCode).toBe(200);
    expect(fakeSupabase._tables.customers).toHaveLength(1);

    // Same event id, second delivery — claimStripeEvent finds status
    // 'completed' and short-circuits before any booking/customer code runs.
    const res2 = makeRes();
    await handler(makeReq(), res2);
    expect(res2.statusCode).toBe(200);
    expect(fakeSupabase._tables.customers).toHaveLength(1);
    expect(fakeSupabase._tables.bookings).toHaveLength(1);
  });

  it('still returns a successful webhook response, and still sends exactly one customer + one business email, when customer-sync fails', async () => {
    // Force the customers select to blow up — simulate an RLS/permission error.
    const originalFrom = fakeSupabase.from;
    fakeSupabase.from = (table) => {
      if (table === 'customers') {
        return { select: () => ({ or: () => Promise.reject(new Error('permission denied')) }) };
      }
      return originalFrom(table);
    };

    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(fakeSupabase._tables.bookings).toHaveLength(1);
    expect(fakeSupabase._tables.bookings[0].payment_status).toBe('paid');
    expect(sendMailMock).toHaveBeenCalledTimes(2); // business + customer, no duplicates
  });

});

describe('stripe-webhook — Task 2: Stripe session metadata kept in sync with the persisted reference', () => {
  it('does not call sessions.update when there is no booking_ref collision', async () => {
    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(sessionsUpdateMock).not.toHaveBeenCalled();
  });

  it('updates Stripe session metadata with the final persisted ref, preserving other metadata fields, on a collision', async () => {
    // Seed an existing paid booking already holding the ref this session's
    // metadata claims — forces upsertBookingWithRefRetry to persist a
    // suffixed ref instead.
    fakeSupabase._tables.bookings.push({ id: 'existing-1', booking_ref: 'N152NG160726', stripe_session_id: 'cs_other' });
    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    const persisted = fakeSupabase._tables.bookings.find((b) => b.stripe_session_id === 'cs_test_abc');
    expect(persisted.booking_ref).toBe('N152NG160726-1');

    expect(sessionsUpdateMock).toHaveBeenCalledTimes(1);
    const [sessionId, patch] = sessionsUpdateMock.mock.calls[0];
    expect(sessionId).toBe('cs_test_abc');
    expect(patch.metadata.booking_ref).toBe('N152NG160726-1');
    // Every other metadata field from the original session is preserved.
    expect(patch.metadata.fullName).toBe('Jane Smith');
    expect(patch.metadata.email).toBe('jane@example.com');
    expect(patch.metadata.confirmation_token).toBe('a'.repeat(64));
  });

  it('notification functions (customer email) receive the final, collision-resolved reference', async () => {
    fakeSupabase._tables.bookings.push({ id: 'existing-1', booking_ref: 'N152NG160726', stripe_session_id: 'cs_other' });
    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    const customerCall = sendMailMock.mock.calls.find((c) => c[0].to === 'jane@example.com');
    expect(customerCall[0].html).toContain('N152NG160726-1');
  });

  it('a Stripe metadata-update failure does not fail the webhook, does not change payment status, and is logged without PII', async () => {
    fakeSupabase._tables.bookings.push({ id: 'existing-1', booking_ref: 'N152NG160726', stripe_session_id: 'cs_other' });
    sessionsUpdateMock.mockRejectedValueOnce(Object.assign(new Error('Stripe API error'), { code: 'api_error' }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    const persisted = fakeSupabase._tables.bookings.find((b) => b.stripe_session_id === 'cs_test_abc');
    expect(persisted.payment_status).toBe('paid');
    expect(persisted.booking_ref).toBe('N152NG160726-1');

    const metaSyncWarnCall = warnSpy.mock.calls.find((c) => String(c[0]).includes('metadata sync failed'));
    expect(metaSyncWarnCall).toBeDefined();
    // No email/phone/name anywhere in the logged arguments.
    expect(JSON.stringify(metaSyncWarnCall)).not.toMatch(/jane@example\.com|07700900000|Jane Smith/);

    warnSpy.mockRestore();
  });
});

describe('stripe-webhook — Task 3: fallback-created row carries every field the checkout-time insert would have', () => {
  it('persists confirmation_token, terms acceptance fields, and every other required field when this webhook is the one creating the row', async () => {
    constructEventMock.mockReturnValue(makeEvent('evt_1'));
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    const row = fakeSupabase._tables.bookings.find((b) => b.stripe_session_id === 'cs_test_abc');
    expect(row).toMatchObject({
      booking_ref:               'N152NG160726',
      stripe_session_id:         'cs_test_abc',
      stripe_payment_intent_id:  'pi_test_abc',
      payment_status:            'paid',
      deposit_amount:            30,
      full_name:                 'Jane Smith',
      email:                     'jane@example.com',
      phone:                     '07700900000',
      address:                   '1 Test St',
      postcode:                  'N15 2NG',
      service:                   'End of tenancy',
      preferred_date:            '2026-08-01',
      preferred_time:            'Flexible',
      confirmation_token:        'a'.repeat(64),
      terms_accepted:            true,
      terms_accepted_at:         '2026-07-14T10:00:00.000Z',
      terms_version:             '2026-07-14',
      cancellation_policy_version: '2026-07-14',
      total_price:               249,
    });
  });

  it('leaves terms_accepted null (never fabricated) rather than false when the metadata field is absent', async () => {
    constructEventMock.mockReturnValue(makeEvent('evt_1', { terms_accepted: '' }));
    const res = makeRes();
    await handler(makeReq(), res);

    const row = fakeSupabase._tables.bookings.find((b) => b.stripe_session_id === 'cs_test_abc');
    expect(row.terms_accepted).toBeNull();
  });
});
