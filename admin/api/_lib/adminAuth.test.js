import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  })),
}));

const { verifyAdminRequest } = await import('./adminAuth.js');

function makeReq(headers) {
  return { headers };
}

const ORIGINAL_ENV = { ...process.env };

describe('verifyAdminRequest', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns 500 when required server env vars are missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await verifyAdminRequest(makeReq({ authorization: 'Bearer anything' }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('returns 401 when no bearer token is present', async () => {
    const result = await verifyAdminRequest(makeReq({}));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is not a Bearer token', async () => {
    const result = await verifyAdminRequest(makeReq({ authorization: 'Basic abc123' }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it('returns 401 when the token is invalid or expired', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });

    const result = await verifyAdminRequest(makeReq({ authorization: 'Bearer bad-token' }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it('returns 403 when the token is valid but the user is missing from admin_users', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'someone@example.com' } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await verifyAdminRequest(makeReq({ authorization: 'Bearer good-token' }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('returns 500 when the admin_users lookup itself fails', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'someone@example.com' } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: '500', message: 'db error' } });

    const result = await verifyAdminRequest(makeReq({ authorization: 'Bearer good-token' }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('returns the admin profile for a valid, authorised admin', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'owner@example.com' } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Sam Wilson' },
      error: null,
    });

    const result = await verifyAdminRequest(makeReq({ authorization: 'Bearer good-token' }));

    expect(result.ok).toBe(true);
    expect(result.admin).toEqual({
      id: 'user-1',
      email: 'owner@example.com',
      displayName: 'Sam Wilson',
    });
  });

  it('never includes the service-role key in any returned result', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'owner@example.com' } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({ data: { id: 'user-1', display_name: 'Sam' }, error: null });

    const result = await verifyAdminRequest(makeReq({ authorization: 'Bearer good-token' }));

    expect(JSON.stringify(result)).not.toContain('test-service-role-key');
  });
});
