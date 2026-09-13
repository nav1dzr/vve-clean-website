import { createHash, randomUUID } from 'node:crypto';
import { verifyAdminRequest } from './adminAuth.js';
import { corsHeaders } from './cors.js';
import { readJsonBody } from './body.js';
import { getServiceClient } from './supabaseAdmin.js';
import { deliverEnquiry } from './enquiryNotifications.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ['new', 'contacted', 'qualified', 'closed'];
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function validateEnquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request body.');
  const full_name = clean(body.fullName, 150);
  const email = clean(body.email, 254).toLowerCase();
  const message = clean(body.message, 5000);
  if (full_name.length < 2) throw new Error('Full name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email address is required.');
  if (message.length < 5) throw new Error('Please enter a message.');
  if (typeof body.message === 'string' && body.message.length > 5000) throw new Error('Please keep your message under 5,000 characters.');
  if (body.requestKey !== undefined && (typeof body.requestKey !== 'string' || !UUID.test(body.requestKey))) throw new Error('Invalid request identifier.');
  const attribution = {};
  for (const key of ['first_source', 'last_source', 'landing_page', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid']) {
    if (typeof body.attribution?.[key] === 'string') attribution[key] = key === 'landing_page' ? clean(body.attribution[key], 500).split(/[?#]/)[0] : clean(body.attribution[key], 500);
  }
  const row = { full_name, email, phone: clean(body.phone, 40), service: clean(body.service, 80), message,
    source_page: clean(body.sourcePage, 200).split(/[?#]/)[0], marketing_opt_in: body.marketingOptIn === true, attribution };
  return { ...row, request_key: body.requestKey || randomUUID(),
    request_fingerprint: createHash('sha256').update(JSON.stringify(row)).digest('hex') };
}

export async function saveEnquiry(supabase, row) {
  const find = async () => {
    const { data, error } = await supabase.from('contact_enquiries').select('*').eq('request_key', row.request_key).maybeSingle();
    if (error) throw new Error('Enquiries are temporarily unavailable. Please try again or call us.');
    if (data && data.request_fingerprint !== row.request_fingerprint) throw new Error('This enquiry changed. Please refresh the form before sending again.');
    return data;
  };
  const existing = await find();
  if (existing) return { row: existing, replayed: true };
  const { data, error } = await supabase.from('contact_enquiries').insert(row).select('*').single();
  if (error || !data) {
    const concurrent = await find();
    if (concurrent) return { row: concurrent, replayed: true };
    throw new Error('We could not save your enquiry. Please try again or call us.');
  }
  return { row: data, replayed: false };
}

export async function enquiriesHandler(req, res) {
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  const send = (status, data) => { res.writeHead(status, headers); return res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
  if (!['GET', 'POST'].includes(req.method)) return send(405, { error: 'Method not allowed' });
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return send(auth.status, { error: auth.error });
  const db = getServiceClient();
  if (!db) return send(503, { error: 'Enquiries are not configured.' });
  try {
    const params = new URL(req.url, 'https://admin.local').searchParams;
    if (req.method === 'GET') {
      const offset = Math.floor(Math.max(0, Math.min(100000, Number(params.get('offset')) || 0)));
      let query = db.from('contact_enquiries').select('id,full_name,email,phone,service,message,source_page,status,delivery,notes,created_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 29);
      if (STATUSES.includes(params.get('status'))) query = query.eq('status', params.get('status'));
      const { data, error, count } = await query;
      if (error) throw new Error('Enquiries could not be loaded.');
      return send(200, { enquiries: data || [], total: count || 0 });
    }
    let body;
    try { body = await readJsonBody(req, 32768); }
    catch { return send(400, { error: 'Send a valid request with notes under 5,000 characters.' }); }
    if (!body || !UUID.test(body.id)) return send(400, { error: 'A valid enquiry is required.' });
    if (body.action === 'retry') {
      const { data, error } = await db.from('contact_enquiries').select('*').eq('id', body.id).single();
      if (error || !data) return send(404, { error: 'Enquiry not found.' });
      if (Object.values(data.delivery || {}).some(channel => ['sending', 'failed'].includes(channel?.status)) && body.confirmRetry !== true) return send(409, { error: 'Check the destinations before retrying an unconfirmed notification.' });
      return send(200, { delivery: await deliverEnquiry(db, data, { retryUnconfirmed: body.confirmRetry === true }) });
    }
    if (body.action !== 'update' || !STATUSES.includes(body.status)) return send(400, { error: 'Choose a valid enquiry status.' });
    if (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) return send(400, { error: 'Refresh the enquiry before saving.' });
    if (typeof body.notes !== 'string' || body.notes.length > 5000) return send(400, { error: 'Keep staff notes under 5,000 characters.' });
    const { data: updated, error } = await db.from('contact_enquiries').update({ status: body.status, notes: clean(body.notes, 5000), updated_at: new Date().toISOString() }).eq('id', body.id).eq('updated_at', body.expectedUpdatedAt).select('id').maybeSingle();
    if (error) throw new Error('Enquiry could not be updated.');
    if (!updated) return send(409, { error: 'This enquiry changed since you opened it. Copy your notes, refresh and review the latest version before saving.' });
    return send(200, { ok: true });
  } catch (error) { return send(503, { error: error.message || 'Enquiries are temporarily unavailable.' }); }
}
