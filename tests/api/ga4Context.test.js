import { afterEach, describe, expect, it, vi } from 'vitest';
import { normaliseGa4Context, saveGa4Context } from '../../api/_lib/ga4Context.js';

const now = Date.parse('2026-10-04T12:00:00.000Z');
const env = { GA4_BOOKING_MEASUREMENT_MODE: 'validate', GA4_MEASUREMENT_ID: 'G-TEST123' };
const valid = {
  measurement_id: 'G-TEST123', client_id: '123.456', session_id: '789',
  captured_at: '2026-10-04T11:59:00.000Z', consent_recorded_at: '2026-10-03T12:00:00.000Z',
  consent_version: '2026-07-14', analytics: true, advertising: false,
};
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('server-controlled GA4 context', () => {
  it('allowlists metadata and stamps server mode, never forwards arbitrary browser keys', () => {
    const result = normaliseGa4Context({ ...valid, mode: 'live', name: 'Synthetic Name', email: 'test@example.test', private_token: 'private', arbitrary: {} }, { env, now });
    expect(result).toEqual({ ...valid, mode: 'validate' });
  });
  it('defaults disabled and requires matching configured GA4 property', () => {
    expect(normaliseGa4Context(valid, { env: {}, now })).toBeNull();
    expect(normaliseGa4Context(valid, { env: { ...env, GA4_MEASUREMENT_ID: 'G-OTHER' }, now })).toBeNull();
  });
  it.each([
    { analytics: false }, { analytics: 'true' }, { advertising: 'yes' },
    { consent_version: 'old' }, { client_id: 'customer@example.test' },
    { captured_at: '2026-10-04T12:02:00.000Z' }, { captured_at: '2026-10-01T12:00:00.000Z' },
    { consent_recorded_at: 'invalid' }, { consent_recorded_at: '2025-01-01T12:00:00.000Z' },
  ])('rejects invalid identity/consent/timestamp %o', patch => {
    expect(normaliseGa4Context({ ...valid, ...patch }, { env, now })).toBeNull();
  });
  it('drops optional malformed session data', () => {
    expect(normaliseGa4Context({ ...valid, session_id: 'address' }, { env, now })).not.toHaveProperty('session_id');
  });
  it('does not touch the database when disabled', async () => {
    vi.stubEnv('GA4_BOOKING_MEASUREMENT_MODE', ''); const db = { from: vi.fn() };
    await saveGa4Context(db, 'test-booking', valid); expect(db.from).not.toHaveBeenCalled();
  });
  it('a missing migration cannot make a saved booking fail or leak error details', async () => {
    vi.stubEnv('GA4_BOOKING_MEASUREMENT_MODE', 'validate'); vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST123');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const recent = { ...valid, captured_at: new Date().toISOString(), consent_recorded_at: new Date().toISOString() };
    const eq = vi.fn(async () => ({ error: { message: 'sensitive database detail' } }));
    const db = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) };
    await expect(saveGa4Context(db, 'test-booking', recent)).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith('id', 'test-booking');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('sensitive');
  });
});
