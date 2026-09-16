import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ account: vi.fn(), hooks: vi.fn(), verify: vi.fn(), send: vi.fn() }));
vi.mock('stripe', () => ({ default: class { accounts = { retrieve: mocks.account }; webhookEndpoints = { list: mocks.hooks }; } }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ verify: mocks.verify, sendMail: mocks.send }) } }));
import { bookingReadiness, isBookingWorker } from '../../../api/_lib/bookingReadiness.js';
describe('private booking readiness', () => {
  beforeEach(() => {
    vi.stubEnv('BOOKING_JOURNEY_WORKER_SECRET', 'a'.repeat(48));
    vi.stubEnv('BOOKING_JOURNEY_TOKEN_SECRET', 'b'.repeat(48));
    vi.stubEnv('GMAIL_SENDER', 'sender@example.com'); vi.stubEnv('GMAIL_APP_PASSWORD', 'private');
    vi.stubEnv('BUSINESS_EMAIL', 'owner@example.com'); vi.stubEnv('TELEGRAM_BOT_TOKEN', 'private'); vi.stubEnv('TELEGRAM_CHAT_ID', 'owner-chat');
    mocks.account.mockResolvedValue({ id: 'acct_test', charges_enabled: true });
    mocks.hooks.mockResolvedValue({ data: [{ status: 'enabled', url: 'https://www.vveclean.co.uk/api/stripe-webhook', enabled_events: ['checkout.session.completed'] }] });
    mocks.verify.mockResolvedValue(true); mocks.send.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it('rejects missing, incorrect and non-ASCII worker secrets without throwing', () => {
    expect(isBookingWorker({ headers: {} })).toBe(false);
    expect(isBookingWorker({ headers: { authorization: 'Bearer ' + 'é'.repeat(48) } })).toBe(false);
    expect(isBookingWorker({ headers: { authorization: 'Bearer ' + 'a'.repeat(48) } })).toBe(true);
  });
  it('checks connections without sending unless explicitly requested', async () => {
    const result = await bookingReadiness();
    expect(result.stripe.ok).toBe(true); expect(result.email.ok).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled(); expect(fetch.mock.calls[0][0]).toContain('/getChat');
  });
  it('sends tests only to configured owner destinations', async () => {
    await bookingReadiness({ notify: true, recipient: 'customer@example.com' });
    expect(mocks.send.mock.calls[0][0].to).toBe('owner@example.com');
    expect(JSON.parse(fetch.mock.calls[0][1].body).chat_id).toBe('owner-chat');
  });
  it('reports failures without exposing provider errors or stopping other checks', async () => {
    mocks.verify.mockRejectedValue(new Error('private password'));
    const result = await bookingReadiness();
    expect(result.email).toEqual({ ok: false }); expect(result.telegram.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private password');
  });
});
