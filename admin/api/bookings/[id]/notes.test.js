import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();
const getServiceClientMock = vi.fn();

vi.mock('../../_lib/adminAuth.js', () => ({ verifyAdminRequest: (...args) => verifyAdminRequestMock(...args) }));
vi.mock('../../_lib/supabaseAdmin.js', () => ({ getServiceClient: (...args) => getServiceClientMock(...args) }));

const { default: handler } = await import('./notes.js');

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

function makeReq(method, { url = '/api/bookings/x/notes', headers = { authorization: 'Bearer t' }, bodyObj } = {}) {
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

function makeClient({ bookingLookup, notesQuery, notesInsert }) {
  return {
    from(table) {
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(bookingLookup),
            }),
          }),
        };
      }
      if (table === 'internal_notes') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve(notesQuery),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve(notesInsert),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('/api/bookings/:id/notes', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('rejects unsupported methods', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq('DELETE', { url: `/api/bookings/${VALID_UUID}/notes` }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 for a missing/invalid token before touching the database', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();
    await handler(makeReq('GET', { url: `/api/bookings/${VALID_UUID}/notes` }), res);
    expect(res.statusCode).toBe(401);
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();
    await handler(makeReq('GET', { url: `/api/bookings/${VALID_UUID}/notes` }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects an invalid booking UUID', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const res = makeRes();
    await handler(makeReq('GET', { url: '/api/bookings/N15NJ180726/notes' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the booking does not exist', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    getServiceClientMock.mockReturnValue(makeClient({ bookingLookup: { data: null, error: null } }));
    const res = makeRes();
    await handler(makeReq('GET', { url: `/api/bookings/${VALID_UUID}/notes` }), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns notes newest-first with author display name', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    getServiceClientMock.mockReturnValue(
      makeClient({
        bookingLookup: { data: { id: VALID_UUID }, error: null },
        notesQuery: {
          data: [
            { id: 'n2', note: 'Second note', created_at: '2026-07-12T00:00:00.000Z', author: { id: 'admin-1', display_name: 'Sam' } },
            { id: 'n1', note: 'First note', created_at: '2026-07-11T00:00:00.000Z', author: { id: 'admin-1', display_name: 'Sam' } },
          ],
          error: null,
        },
      }),
    );
    const res = makeRes();
    await handler(makeReq('GET', { url: `/api/bookings/${VALID_UUID}/notes` }), res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notes[0].id).toBe('n2');
    expect(body.notes[1].id).toBe('n1');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('rejects an empty note without ever inserting', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    const client = makeClient({ bookingLookup: { data: { id: VALID_UUID }, error: null } });
    const insertSpy = vi.spyOn(client, 'from');
    getServiceClientMock.mockReturnValue(client);

    const res = makeRes();
    await handler(makeReq('POST', { url: `/api/bookings/${VALID_UUID}/notes`, bodyObj: { note: '   ' } }), res);

    expect(res.statusCode).toBe(400);
    // Only the booking-existence lookup should have touched `from` — never internal_notes.
    expect(insertSpy.mock.calls.some((call) => call[0] === 'internal_notes')).toBe(false);
  });

  it('rejects an oversized note', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    getServiceClientMock.mockReturnValue(makeClient({ bookingLookup: { data: { id: VALID_UUID }, error: null } }));

    const res = makeRes();
    await handler(
      makeReq('POST', { url: `/api/bookings/${VALID_UUID}/notes`, bodyObj: { note: 'a'.repeat(2001) } }),
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('ignores any browser-supplied author id and uses the authenticated admin instead', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'real-admin-id' } });
    const client = makeClient({
      bookingLookup: { data: { id: VALID_UUID }, error: null },
      notesInsert: {
        data: { id: 'n3', note: 'Note text', created_at: '2026-07-13T00:00:00.000Z', author: { id: 'real-admin-id', display_name: 'Sam' } },
        error: null,
      },
    });
    let capturedInsert;
    const originalInternalNotes = client.from;
    client.from = (table) => {
      const result = originalInternalNotes(table);
      if (table === 'internal_notes') {
        const originalInsert = result.insert;
        result.insert = (row) => {
          capturedInsert = row;
          return originalInsert(row);
        };
      }
      return result;
    };
    getServiceClientMock.mockReturnValue(client);

    const res = makeRes();
    await handler(
      makeReq('POST', {
        url: `/api/bookings/${VALID_UUID}/notes`,
        bodyObj: { note: 'Note text', author_admin_id: 'attacker-supplied-id', authorAdminId: 'attacker-supplied-id' },
      }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(capturedInsert.author_admin_id).toBe('real-admin-id');
    expect(capturedInsert.author_admin_id).not.toBe('attacker-supplied-id');
  });

  it('never includes a service-role-shaped field or confirmation_token in the response', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    getServiceClientMock.mockReturnValue(
      makeClient({
        bookingLookup: { data: { id: VALID_UUID }, error: null },
        notesInsert: {
          data: { id: 'n3', note: 'Note text', created_at: '2026-07-13T00:00:00.000Z', author: { id: 'admin-1', display_name: 'Sam' } },
          error: null,
        },
      }),
    );
    const res = makeRes();
    await handler(makeReq('POST', { url: `/api/bookings/${VALID_UUID}/notes`, bodyObj: { note: 'Note text' } }), res);

    expect(res.body).not.toMatch(/confirmation_token|service.?role/i);
  });

  it('returns a generic 500 without leaking database error detail', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: true, admin: { id: 'admin-1' } });
    getServiceClientMock.mockReturnValue(
      makeClient({
        bookingLookup: { data: { id: VALID_UUID }, error: null },
        notesQuery: { data: null, error: { code: '500', message: 'internal detail' } },
      }),
    );
    const res = makeRes();
    await handler(makeReq('GET', { url: `/api/bookings/${VALID_UUID}/notes` }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
  });
});
