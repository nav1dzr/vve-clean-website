import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { transportSend } = vi.hoisted(() => ({ transportSend: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: transportSend }) } }));
import { sendMail } from '../../../api/_lib/mailer.js';

beforeEach(() => {
  vi.clearAllMocks();
  transportSend.mockResolvedValue({ messageId: 'synthetic-message' });
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('GMAIL_SENDER', 'sender@example.com');
  vi.stubEnv('GMAIL_APP_PASSWORD', 'synthetic');
  vi.stubEnv('BUSINESS_EMAIL', 'admin@vveclean.co.uk');
});
afterEach(() => vi.unstubAllEnvs());

const message = { to: 'customer@example.com', subject: 'Your invoice', html: '<p>Invoice</p>', text: 'Invoice' };

describe('invoice and receipt reply address', () => {
  it('keeps the sender and recipient while directing customer replies to contact', async () => {
    await expect(sendMail(message)).resolves.toMatchObject({ ok: true });
    expect(transportSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'sender@example.com', to: message.to, replyTo: 'contact@vveclean.co.uk',
    }));
  });

  it('keeps preview replies and delivery inside the approved test inbox', async () => {
    for (const [key, value] of Object.entries({
      VERCEL_ENV: 'preview', VVE_PREVIEW_ISOLATION_APPROVED: 'true',
      VVE_PREVIEW_SUPABASE_PROJECT_REF: 'stageisolatedproject',
      VITE_SUPABASE_URL: 'https://stageisolatedproject.supabase.co', SUPABASE_URL: '',
      VVE_PREVIEW_TEST_EMAIL: 'preview@example.com', STRIPE_SECRET_KEY: '', BOOKING_JOURNEY_MODE: 'test',
    })) vi.stubEnv(key, value);
    await expect(sendMail(message)).resolves.toMatchObject({ ok: true });
    expect(transportSend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'preview@example.com', replyTo: 'preview@example.com', subject: '[TEST] Your invoice',
    }));
  });
});
