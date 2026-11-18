import { getServiceClient } from './supabaseAdmin.js';
import { previewIsolation } from './previewIsolation.js';
import { readJsonBody } from './body.js';
import { viewPack } from './clientPacks.js';
export const config = { api: { bodyParser: false }, maxDuration: 30 };
export default async function handler(req, res) {
 const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
 const reply = (status, value) => { res.writeHead(status, headers); res.end(JSON.stringify(value)); };
 if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
 const isolation = previewIsolation(); if (!isolation.ok) return reply(403, { error: isolation.error });
 if (process.env.CLIENT_PACKS_ENABLED !== 'true') return reply(503, { error: 'Customer viewing pages are not enabled.' });
 const db = getServiceClient(); if (!db) return reply(503, { error: 'The viewing page is temporarily unavailable.' });
 try {
  const { token } = await readJsonBody(req, 1024);
  return reply(200, await viewPack(db, token));
 } catch (err) { return reply(err.status || 400, { error: err.status ? err.message : 'This viewing link could not be opened.' }); }
}
