import { loadWebsitePricebook } from './_lib/websitePricebook.js';

export default async function handler(req, res) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const send = (status, data) => { res.writeHead(status, headers); return res.end(JSON.stringify(data)); };
  if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
  try {
    const { id, version, overrides, publishedAt } = await loadWebsitePricebook();
    return send(200, { id, version, overrides, publishedAt });
  } catch { return send(503, { error: 'Website prices are temporarily unavailable. Please call us or try again shortly.' }); }
}
