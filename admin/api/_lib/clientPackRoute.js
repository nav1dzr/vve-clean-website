import { verifyAdminRequest } from './adminAuth.js';
import { getServiceClient } from './supabaseAdmin.js';
import { readJsonBody } from './body.js';
import { corsHeaders } from './cors.js';
import { actOnPack, adminFields, getPack, listPacks } from './clientPacks.js';
export const config = { api: { bodyParser: false }, maxDuration: 30 };
export default async function handler(req, res) {
 const headers = { ...corsHeaders(req.headers.origin || ''), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
 const reply = (status, value) => { res.writeHead(status, headers); res.end(JSON.stringify(value)); };
 if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
 if (!['GET', 'POST'].includes(req.method)) return reply(405, { error: 'Method not allowed.' });
 const auth = await verifyAdminRequest(req); if (!auth.ok) return reply(auth.status, { error: auth.error });
 if (process.env.CLIENT_PACKS_ENABLED !== 'true') return reply(503, { error: 'Customer viewing pages are not enabled.' });
 const db = getServiceClient(); if (!db) return reply(503, { error: 'Client pack storage is unavailable.' });
 try {
  if (req.method === 'POST') return reply(200, await actOnPack(db, auth.admin.id, await readJsonBody(req, 12000)));
  const packId = new URL(req.url, 'https://admin.vveclean.co.uk').searchParams.get('id');
  return reply(200, packId ? { pack: adminFields(await getPack(db, packId)) } : { packs: await listPacks(db) });
 } catch (err) { return reply(err.status || 400, { error: err.status ? err.message : 'The request could not be completed. Reload before trying again.' }); }
}
