import { afterEach, describe, expect, it, vi } from 'vitest';
const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({ messageId: 'synthetic' }) }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: send }) } }));
import { sendMail } from '../api/_lib/mailer.js';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('shared CRM mailer in previews', () => {
  it('does not send from an unapproved preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VVE_PREVIEW_ISOLATION_APPROVED', '');
    expect((await sendMail({ to: 'customer@example.com', subject: 'Invoice', html: '<p>Invoice</p>' })).ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it('redirects approved preview invoices and receipts to the explicitly selected test inbox', async () => {
    for (const [key, value] of Object.entries({ VERCEL_ENV: 'preview', VVE_PREVIEW_ISOLATION_APPROVED: 'true', VVE_PREVIEW_SUPABASE_PROJECT_REF: 'stageisolatedproject', VITE_SUPABASE_URL: 'https://stageisolatedproject.supabase.co', SUPABASE_URL: '', VVE_PREVIEW_TEST_EMAIL: 'preview@example.com', STRIPE_SECRET_KEY: '', BOOKING_JOURNEY_MODE: 'test', GMAIL_SENDER: 'sender@example.com', GMAIL_APP_PASSWORD: 'synthetic' })) vi.stubEnv(key, value);
    expect((await sendMail({ to: 'customer@example.com', subject: 'Invoice', html: '<p>Invoice</p>' })).ok).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'preview@example.com', subject: '[TEST] Invoice' }));
  });
});
