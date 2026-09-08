import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const { find, insert, db } = vi.hoisted(() => {
  const find = vi.fn(); const insert = vi.fn();
  const db = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: find }) }), insert: row => ({ select: () => ({ single: () => insert(row) }) }) })) };
  return { find, insert, db };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
vi.mock('../../admin/api/_lib/enquiryNotifications.js', () => ({ deliverEnquiry: vi.fn() }));
const { deliverEnquiry } = await import('../../admin/api/_lib/enquiryNotifications.js');
const { validateEnquiry, saveEnquiry } = await import('../../admin/api/_lib/enquiries.js');
const { default: handler } = await import('../../api/contact.js');
const body = { fullName: 'Test customer', email: 'customer@example.com', message: 'Please quote for my sofa.', requestKey: 'ae21325d-e86d-46dd-87bd-050b7b5b8e19' };
const response = () => ({ status: 0, body: null, writeHead(status) { this.status = status; }, end(raw) { this.body = raw ? JSON.parse(raw) : null; } });
beforeEach(() => {
  vi.clearAllMocks(); process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  find.mockResolvedValue({ data: null, error: null });
  insert.mockImplementation(row => ({ data: { ...row, id: '9fec4dcd-c52d-4772-aa57-749d16aeb21a' }, error: null }));
  deliverEnquiry.mockResolvedValue({ customerEmail: { status: 'unconfigured' } });
});
describe('durable contact enquiries', () => {
  it('never reports success or sends notifications when persistence fails', async () => {
    insert.mockResolvedValue({ data: null, error: { code: 'failure' } });
    const res = response(); await handler({ method: 'POST', headers: {}, body }, res);
    expect(res.status).toBe(503); expect(deliverEnquiry).not.toHaveBeenCalled();
  });
  it('acknowledges a saved enquiry even when notification delivery fails', async () => {
    deliverEnquiry.mockRejectedValue(new Error('timeout'));
    const res = response(); await handler({ method: 'POST', headers: {}, body }, res);
    expect(res.status).toBe(201); expect(res.body.enquiryId).toBeTruthy(); expect(insert).toHaveBeenCalledTimes(1);
  });
  it('replays the same submission without duplicates or duplicate emails', async () => {
    find.mockResolvedValue({ data: { ...validateEnquiry(body), id: 'existing' }, error: null });
    const res = response(); await handler({ method: 'POST', headers: {}, body }, res);
    expect(res.body).toMatchObject({ ok: true, replayed: true, enquiryId: 'existing' });
    expect(insert).not.toHaveBeenCalled(); expect(deliverEnquiry).not.toHaveBeenCalled();
  });
  it('rejects an identifier reused with changed content', async () => {
    find.mockResolvedValue({ data: { ...validateEnquiry(body), request_fingerprint: 'different' }, error: null });
    await expect(saveEnquiry(db, validateEnquiry(body))).rejects.toThrow(/changed/);
  });
  it('coalesces simultaneous saves after the unique-key insertion race', async () => {
    const row = { ...validateEnquiry(body), id: '9fec4dcd-c52d-4772-aa57-749d16aeb21a' };
    find.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: null }).mockResolvedValue({ data: row });
    insert.mockResolvedValueOnce({ data: row }).mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    const first = response(), second = response();
    await Promise.all([handler({ method: 'POST', headers: {}, body }, first), handler({ method: 'POST', headers: {}, body }, second)]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.enquiryId).toBe(second.body.enquiryId);
    expect(deliverEnquiry).toHaveBeenCalledOnce();
  });
  it('preserves UTF-8 characters even when a streamed body splits inside a character', async () => {
    const request = new EventEmitter(); request.method = 'POST'; request.headers = {}; request.destroy = vi.fn();
    const res = response(), pending = handler(request, res);
    const raw = Buffer.from(JSON.stringify({ ...body, fullName: 'Zoë 客户', message: 'Please quote — 谢谢.' }));
    for (const byte of raw) request.emit('data', Buffer.from([byte]));
    request.emit('end'); await pending;
    expect(res.status).toBe(201);
    expect(insert.mock.calls[0][0]).toMatchObject({ full_name: 'Zoë 客户', message: 'Please quote — 谢谢.' });
  });
  it('rejects invalid data and strips query strings from source pages', () => {
    for (const invalid of [null, [], { ...body, phone: 123, email: 123 }, { ...body, message: 'x'.repeat(5001) }, { ...body, requestKey: '' }, { ...body, requestKey: [] }]) expect(() => validateEnquiry(invalid)).toThrow();
    expect(validateEnquiry({ ...body, sourcePage: '/contact?email=private' }).source_page).toBe('/contact');
  });
});
