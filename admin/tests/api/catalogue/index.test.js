import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../../api/_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('../../../api/catalogue.js');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function makeRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers;
    },
    end(body) {
      res.body = body || '';
    },
  };
  return res;
}

function makeReq(method, { url = '/api/catalogue', headers = { authorization: 'Bearer t' }, bodyObj } = {}) {
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

// Chainable query-builder stub: every builder method returns the same
// object, and awaiting it resolves `result`. Mutating methods capture
// their payloads for assertions.
function makeCatalogueTable({ listResult, insertResult, updateResult, seedNamesResult, seedInsertResult } = {}) {
  const captured = { insert: [], update: [] };
  const table = {
    captured,
    select: () => table,
    eq: () => table,
    or: () => table,
    order: () => table,
    limit: () => table,
    update: (row) => {
      captured.update.push(row);
      return {
        eq: () => ({
          select: () => ({
            maybeSingle: () => Promise.resolve(updateResult),
          }),
        }),
      };
    },
    then: (resolve) => resolve(listResult ?? seedNamesResult),
  };
  // insert() covers both paths: create awaits insert(...).select().single(),
  // seed awaits insert(...).select('id') directly (thenable).
  table.insert = (rows) => {
    captured.insert.push(rows);
    const selectChain = {
      single: () => Promise.resolve(insertResult),
      then: (resolve) => resolve(seedInsertResult ?? insertResult),
    };
    return { select: () => selectChain };
  };
  return {
    from(tableName) {
      if (tableName !== 'catalogue_items') throw new Error(`Unexpected table: ${tableName}`);
      return table;
    },
  };
}

const SAMPLE_ROW = {
  id: VALID_UUID,
  name: 'Bedroom carpet clean',
  description: null,
  default_price_pence: 5000,
  item_type: 'service',
  category: 'Carpets',
  status: 'active',
  created_at: '2026-07-25T00:00:00.000Z',
  updated_at: '2026-07-25T00:00:00.000Z',
};

const validCreateBody = {
  name: 'Bedroom carpet clean',
  defaultPricePence: 5000,
  itemType: 'service',
  category: 'Carpets',
  description: null,
};

function authed() {
  verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
}

describe('/api/catalogue', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  // ── Auth ──────────────────────────────────────────────────────────────
  it('returns 401 without a valid token before touching the database', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(401);
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: validCreateBody }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects unsupported methods', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('DELETE'), res);
    expect(res.statusCode).toBe(405);
  });

  // ── List ──────────────────────────────────────────────────────────────
  it('lists active items by default and maps snake_case to camelCase', async () => {
    authed();
    getServiceClientMock.mockReturnValue(makeCatalogueTable({ listResult: { data: [SAMPLE_ROW], error: null } }));
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results[0].defaultPricePence).toBe(5000);
    expect(body.results[0].itemType).toBe('service');
    expect(body.results[0]).not.toHaveProperty('default_price_pence');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('rejects an invalid status filter', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('GET', { url: '/api/catalogue?status=deleted' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid type filter', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('GET', { url: '/api/catalogue?type=subscription' }), res);
    expect(res.statusCode).toBe(400);
  });

  // ── Create validation ─────────────────────────────────────────────────
  it('rejects a missing name', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: { ...validCreateBody, name: '  ' } }), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/name/i);
  });

  it('rejects a non-integer pence price', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: { ...validCreateBody, defaultPricePence: 49.99 } }), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/whole number of pence/);
  });

  it('rejects a negative price', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: { ...validCreateBody, defaultPricePence: -100 } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a non-numeric price', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: { ...validCreateBody, defaultPricePence: '5000' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid itemType', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: { ...validCreateBody, itemType: 'subscription' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('creates an item with integer pence preserved exactly', async () => {
    authed();
    const client = makeCatalogueTable({ insertResult: { data: SAMPLE_ROW, error: null } });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: validCreateBody }), res);
    expect(res.statusCode).toBe(201);
    expect(client.from('catalogue_items').captured.insert[0]).toMatchObject({
      name: 'Bedroom carpet clean',
      default_price_pence: 5000,
      item_type: 'service',
    });
  });

  it('maps a duplicate-name unique violation to 409', async () => {
    authed();
    getServiceClientMock.mockReturnValue(
      makeCatalogueTable({ insertResult: { data: null, error: { code: '23505', message: 'duplicate key' } } }),
    );
    const res = makeRes();
    await handler(makeReq('POST', { bodyObj: validCreateBody }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).not.toContain('duplicate key');
  });

  // ── Update / archive / reactivate ─────────────────────────────────────
  it('rejects a PATCH without a valid UUID id', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('PATCH', { url: '/api/catalogue?id=not-a-uuid', bodyObj: { status: 'archived' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a PATCH with no updatable fields', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('PATCH', { url: `/api/catalogue?id=${VALID_UUID}`, bodyObj: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid status on PATCH', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('PATCH', { url: `/api/catalogue?id=${VALID_UUID}`, bodyObj: { status: 'deleted' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('archives an item via status patch', async () => {
    authed();
    const client = makeCatalogueTable({ updateResult: { data: { ...SAMPLE_ROW, status: 'archived' }, error: null } });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq('PATCH', { url: `/api/catalogue?id=${VALID_UUID}`, bodyObj: { status: 'archived' } }), res);
    expect(res.statusCode).toBe(200);
    expect(client.from('catalogue_items').captured.update[0]).toEqual({ status: 'archived' });
    expect(JSON.parse(res.body).status).toBe('archived');
  });

  it('reactivates an archived item via status patch', async () => {
    authed();
    const client = makeCatalogueTable({ updateResult: { data: SAMPLE_ROW, error: null } });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq('PATCH', { url: `/api/catalogue?id=${VALID_UUID}`, bodyObj: { status: 'active' } }), res);
    expect(res.statusCode).toBe(200);
    expect(client.from('catalogue_items').captured.update[0]).toEqual({ status: 'active' });
  });

  it('returns 404 when patching a non-existent item', async () => {
    authed();
    getServiceClientMock.mockReturnValue(makeCatalogueTable({ updateResult: { data: null, error: null } }));
    const res = makeRes();
    await handler(makeReq('PATCH', { url: `/api/catalogue?id=${VALID_UUID}`, bodyObj: { name: 'New name' } }), res);
    expect(res.statusCode).toBe(404);
  });

  it('keeps prices integer pence through an edit', async () => {
    authed();
    const res = makeRes();
    await handler(
      makeReq('PATCH', { url: `/api/catalogue?id=${VALID_UUID}`, bodyObj: { defaultPricePence: 12.5 } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/whole number of pence/);
  });

  // ── Seed ──────────────────────────────────────────────────────────────
  it('rejects seed via GET', async () => {
    authed();
    const res = makeRes();
    await handler(makeReq('GET', { url: '/api/catalogue?action=seed' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('seed skips names that already exist and only inserts missing ones', async () => {
    authed();
    const client = makeCatalogueTable({
      seedNamesResult: { data: [{ name: 'Bedroom carpet clean' }], error: null },
      seedInsertResult: { data: [{ id: 'a' }, { id: 'b' }], error: null },
    });
    getServiceClientMock.mockReturnValue(client);
    const res = makeRes();
    await handler(makeReq('POST', { url: '/api/catalogue?action=seed' }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.skipped).toBe(1);
    expect(body.inserted).toBe(2);
    const insertedRows = client.from('catalogue_items').captured.insert[0];
    expect(insertedRows.every((r) => r.name.toLowerCase() !== 'bedroom carpet clean')).toBe(true);
    // Every seeded row carries integer pence and a whitelisted type.
    for (const row of insertedRows) {
      expect(Number.isInteger(row.default_price_pence)).toBe(true);
      expect(row.default_price_pence).toBeGreaterThanOrEqual(0);
      expect(['service', 'product']).toContain(row.item_type);
    }
  });
});
