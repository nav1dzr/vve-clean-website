import { rejectUnsafePreview } from './_lib/previewIsolation.js';
import { createClient } from '@supabase/supabase-js';
import { validateEnquiry, saveEnquiry } from '../admin/api/_lib/enquiries.js';
import { deliverEnquiry } from '../admin/api/_lib/enquiryNotifications.js';

export const config = { api: { bodyParser: false } };

const ALLOWED_ORIGINS = [
  process.env.SITE_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

function corsHeaders(origin) {
  const use = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '*');
  return {
    'Access-Control-Allow-Origin':  use,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 32768) throw new Error('Request body too large');
    return raw;
  }
  return new Promise((resolve, reject) => {
    const chunks = []; let bytes = 0;
    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 32768) { reject(new Error('Request body too large')); req.destroy(); return; }
      chunks.push(buffer);
    });
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}


export default async function handler(req, res) {
  if (rejectUnsafePreview(res)) return;
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const send = (status, data) => { res.writeHead(status, headers); return res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
  let row;
  try {
    const body = JSON.parse(await readBody(req));
    if (body?._honeypot) return send(200, { ok: true });
    row = validateEnquiry(body);
  } catch (error) { return send(400, { error: error.message || 'Invalid request body.' }); }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return send(503, { error: 'Enquiries are temporarily unavailable. Please call us or use WhatsApp.' });
  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    const saved = await saveEnquiry(db, row);
    if (!saved.replayed) {
      try { await deliverEnquiry(db, saved.row); }
      catch { console.error('[contact] Enquiry saved; notification delivery needs review in CRM.'); }
    }
    return send(saved.replayed ? 200 : 201, { ok: true, enquiryId: saved.row.id, replayed: saved.replayed });
  } catch (error) { return send(503, { error: error.message || 'Your enquiry could not be saved. Please try again.' }); }
}
