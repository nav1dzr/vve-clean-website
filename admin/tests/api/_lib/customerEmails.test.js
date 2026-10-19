import { describe, it, expect, vi } from 'vitest';
import { previewCustomerEmail, sendCustomerEmail } from '../../../api/_lib/customerEmails.js';
const id = 'd8fcd148-106b-434e-98df-450a69eeabf1';
const input = { id, recipient: 'client@example.com', subject: 'Quotation', body: 'An agreed quotation.', style: 'simple' };
function database() {
  const rows = new Map();
  let failUpdate = 0;
  const db = { rows, failNextUpdate() { failUpdate++; }, from() {
    let insert, update, filters = [];
    const q = { select() { return q; }, insert(value) { insert = value; return q; }, update(value) { update = value; return q; },
      eq(key, value) { filters.push([key,value]); return q; }, single() { return q; }, maybeSingle() { return q; },
      then(resolve) {
        if (insert) {
          if (rows.has(insert.id)) return Promise.resolve({ data: null, error: { code: '23505' } }).then(resolve);
          const row = { ...insert, status: 'draft', created_at: new Date().toISOString(), attempted_at: null, accepted_at: null };
          rows.set(row.id, row); return Promise.resolve({ data: { ...row }, error: null }).then(resolve);
        }
        if (update && failUpdate) { failUpdate--; return Promise.resolve({ data: null, error: {} }).then(resolve); }
        const row = [...rows.values()].find(value => filters.every(([key,v]) => value[key] === v));
        if (row && update) Object.assign(row, update);
        return Promise.resolve({ data: row ? { ...row } : null, error: null }).then(resolve);
      }
    }; return q;
  }};
  return db;
}
describe('manual correspondence sends', () => {
  it('saving/replaying a preview never sends and preserves the stored snapshot', async () => {
    const db = database();
    const a = await previewCustomerEmail(db, 'customer-a', 'owner', input);
    const b = await previewCustomerEmail(db, 'customer-a', 'owner', input);
    expect(a.ok).toBe(true); expect(b.html).toBe(a.html); expect(db.rows.size).toBe(1);
    expect(db.rows.get(id).status).toBe('draft');
    expect(a.email).not.toHaveProperty('content_hash');
  });
  it('rejects reused draft IDs with changed content or a different customer', async () => {
    const db = database(); await previewCustomerEmail(db, 'customer-a', 'owner', input);
    expect((await previewCustomerEmail(db, 'customer-a', 'owner', { ...input, body: 'Changed' })).status).toBe(409);
    expect((await previewCustomerEmail(db, 'customer-b', 'owner', input)).status).toBe(409);
    expect((await sendCustomerEmail(db, 'customer-b', { id, confirmedRecipient: input.recipient })).status).toBe(404);
  });
  it('atomically sends only once across concurrent attempts and retries', async () => {
    const db = database(); await previewCustomerEmail(db, 'customer-a', 'owner', input);
    const send = vi.fn(async () => ({ ok: true, messageId: 'provider-id' }));
    const deps = { send, isConfigured: () => true };
    await Promise.all([sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps), sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps)]);
    const repeated = await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps);
    expect(send).toHaveBeenCalledTimes(1); expect(repeated.email.status).toBe('accepted');
    expect(send.mock.calls[0][0].html).toBe(db.rows.get(id).html_snapshot);
    expect(send.mock.calls[0][0].messageId).toBe('<vve-customer-' + id + '@vveclean.co.uk>');
  });
  it('requires recipient confirmation and a configured mailer before claiming', async () => {
    const db = database(); await previewCustomerEmail(db, 'customer-a', 'owner', input);
    expect((await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: 'wrong@example.com' })).status).toBe(409);
    expect((await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, { isConfigured: () => false })).status).toBe(503);
    expect(db.rows.get(id).status).toBe('draft');
  });
  it('never retries an uncertain provider response', async () => {
    const db = database(); await previewCustomerEmail(db, 'customer-a', 'owner', input);
    const send = vi.fn(async () => { throw new Error('network'); });
    const deps = { send, isConfigured: () => true };
    const a = await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps);
    const b = await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps);
    expect(a.email.status).toBe('uncertain'); expect(b.duplicatePrevented).toBe(true); expect(send).toHaveBeenCalledTimes(1);
  });
  it('blocks retries if delivery succeeded but the status write was lost', async () => {
    const db = database(); await previewCustomerEmail(db, 'customer-a', 'owner', input);
    const send = vi.fn(async () => { db.failNextUpdate(); return { ok: true, messageId: 'sent' }; });
    const deps = { send, isConfigured: () => true };
    const result = await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps);
    expect(result.email.status).toBe('uncertain'); expect(db.rows.get(id).status).toBe('sending');
    await sendCustomerEmail(db, 'customer-a', { id, confirmedRecipient: input.recipient }, deps);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
