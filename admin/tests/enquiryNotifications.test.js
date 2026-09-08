import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import https from 'node:https';
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
import { contactTelegramText, deliverEnquiry } from '../api/_lib/enquiryNotifications.js';

const makeRow = () => ({ id: '1b5cc087-83ab-4053-bc58-b69e613156a1', full_name: 'Test <customer>', email: 'customer@example.com', message: 'Please quote for my sofa.', delivery: {} });
function database(row) {
  let tokenNumber = 0;
  const db = { rpc: vi.fn(async (name, args) => {
    if (name === 'claim_enquiry_delivery') {
      if (row.delivery_claim_token) return { data: null };
      row.delivery_claim_token = `lease-${++tokenNumber}`;
      return { data: structuredClone(row) };
    }
    if (args.p_token !== row.delivery_claim_token) return { data: null };
    if (name === 'record_enquiry_delivery') { row.delivery[args.p_channel] = structuredClone(args.p_result); return { data: true }; }
    if (name === 'finish_enquiry_delivery') { row.delivery_claim_token = null; return { data: structuredClone(row.delivery) }; }
    throw new Error('Unexpected RPC');
  }) };
  return db;
}
beforeEach(() => {
  vi.clearAllMocks(); sendMail.mockResolvedValue({ accepted: ['customer@example.com'] });
  for (const key of ['GOOGLE_SHEET_CONTACT','CONTACT_SHEET_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID']) vi.stubEnv(key, '');
  vi.stubEnv('GMAIL_SENDER', 'sender@example.com'); vi.stubEnv('GMAIL_APP_PASSWORD', 'fake-test-secret'); vi.stubEnv('BUSINESS_EMAIL', 'business@example.com');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('durable enquiry delivery claims', () => {
  it('uses the fresh claim, so a delayed stale retry cannot resend completed channels', async () => {
    const row = makeRow(), stale = structuredClone(row), db = database(row);
    await deliverEnquiry(db, stale);
    await deliverEnquiry(db, stale);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(row.delivery.customerEmail.status).toBe('sent');
  });

  it('prevents overlapping sends while a notification is still running', async () => {
    const row = makeRow(), db = database(row);
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    sendMail.mockReturnValue(pending);
    const first = deliverEnquiry(db, structuredClone(row));
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(2));
    await expect(deliverEnquiry(db, structuredClone(row))).rejects.toThrow(/already being processed/);
    release({ accepted: ['customer@example.com'] }); await first;
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('records each completed channel even when the final lease release fails', async () => {
    const row = makeRow(), db = database(row), original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation((name, args) => name === 'finish_enquiry_delivery' ? { data: null, error: {} } : original(name, args));
    await expect(deliverEnquiry(db, structuredClone(row))).rejects.toThrow(/could not be recorded/);
    expect(row.delivery.businessEmail.status).toBe('sent');
    expect(row.delivery.customerEmail.status).toBe('sent');
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('does not send when the durable pre-send checkpoint fails', async () => {
    const row = makeRow(), db = database(row), original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation((name, args) => name === 'record_enquiry_delivery' && args.p_result.status === 'sending' ? { data: false } : original(name, args));
    await expect(deliverEnquiry(db, structuredClone(row))).rejects.toThrow(/could not be recorded/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('requires an explicit destination check before retrying an uncertain channel', async () => {
    const row = makeRow(), db = database(row);
    row.delivery = { businessEmail: { status: 'sent' }, customerEmail: { status: 'sending' } };
    await deliverEnquiry(db, structuredClone(row));
    expect(sendMail).not.toHaveBeenCalled();
    await deliverEnquiry(db, structuredClone(row), { retryUnconfirmed: true });
    expect(sendMail).toHaveBeenCalledOnce();
    expect(row.delivery.customerEmail.status).toBe('sent');
  });

  it('sends escaped branded multipart email with matching acknowledgement facts', async () => {
    const row = makeRow(); await deliverEnquiry(database(row), structuredClone(row));
    const customer = sendMail.mock.calls.map(([mail]) => mail).find(mail => mail.to === row.email);
    expect(customer.html).toContain('Test &lt;customer&gt;');
    expect(customer.html).toContain('aria-label="VVE Clean"');
    for (const part of [customer.text, customer.html]) {
      expect(part).toContain('opening hours'); expect(part).toContain('VVE Limited trading as VVE Clean');
      expect(part).toContain('17234391'); expect(part).not.toMatch(/within (one|the) hour/);
    }
    expect(customer.replyTo).toBe('business@example.com');
  });

  it('keeps long Telegram summaries within the platform limit with a CRM continuation', () => {
    const text = contactTelegramText({ fullName: 'A'.repeat(150), email: 'E'.repeat(254), phone: '0'.repeat(40), service: 'S'.repeat(80), message: 'x'.repeat(5000) });
    expect(text.length).toBeLessThan(4096);
    expect(text).toContain('Continued in Website enquiries');
  });
  it('redirects both preview emails to the test inbox and suppresses inherited Sheets and Telegram', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VVE_PREVIEW_TEST_EMAIL', 'preview@example.com');
    vi.stubEnv('GOOGLE_SHEET_CONTACT', 'https://never-used.invalid'); vi.stubEnv('CONTACT_SHEET_SECRET', 'synthetic');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'synthetic'); vi.stubEnv('TELEGRAM_CHAT_ID', 'synthetic');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const http = vi.spyOn(https, 'request').mockImplementation(() => { throw new Error('Network is forbidden in this test'); });
    const row = makeRow(); await deliverEnquiry(database(row), structuredClone(row));
    expect(sendMail).toHaveBeenCalledTimes(2);
    for (const [message] of sendMail.mock.calls) {
      expect(message.to).toBe('preview@example.com'); expect(message.replyTo).toBe('preview@example.com'); expect(message.subject).toMatch(/^\[TEST\]/);
    }
    expect(fetchMock).not.toHaveBeenCalled(); expect(http).not.toHaveBeenCalled();
    expect(row.delivery.sheet.status).toBe('unconfigured'); expect(row.delivery.telegram.status).toBe('unconfigured');
  });
});
