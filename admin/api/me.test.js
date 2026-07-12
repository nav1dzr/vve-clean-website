import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminRequestMock = vi.fn();

vi.mock('./_lib/adminAuth.js', () => ({
  verifyAdminRequest: verifyAdminRequestMock,
}));

const { default: handler } = await import('./me.js');

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

describe('GET /api/me', () => {
  beforeEach(() => {
    verifyAdminRequestMock.mockReset();
    process.env.ADMIN_ALLOWED_ORIGINS = '';
  });

  it('rejects non-GET methods', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {} }, res);

    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when verifyAdminRequest reports missing/invalid token', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = makeRes();

    await handler({ method: 'GET', headers: {} }, res);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Missing bearer token' });
  });

  it('returns 403 when the user is not an admin', async () => {
    verifyAdminRequestMock.mockResolvedValue({ ok: false, status: 403, error: 'Not an authorised admin' });
    const res = makeRes();

    await handler({ method: 'GET', headers: { authorization: 'Bearer token' } }, res);

    expect(res.statusCode).toBe(403);
  });

  it('returns only safe profile fields for a verified admin, with no-store caching', async () => {
    verifyAdminRequestMock.mockResolvedValue({
      ok: true,
      admin: { id: 'user-1', email: 'owner@example.com', displayName: 'Sam Wilson' },
    });
    const res = makeRes();

    await handler({ method: 'GET', headers: { authorization: 'Bearer token' } }, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      id: 'user-1',
      displayName: 'Sam Wilson',
      email: 'owner@example.com',
    });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('never includes a service-role-shaped field in the response', async () => {
    verifyAdminRequestMock.mockResolvedValue({
      ok: true,
      admin: { id: 'user-1', email: 'owner@example.com', displayName: 'Sam Wilson' },
    });
    const res = makeRes();

    await handler({ method: 'GET', headers: { authorization: 'Bearer token' } }, res);

    expect(res.body).not.toMatch(/service.?role/i);
  });
});
