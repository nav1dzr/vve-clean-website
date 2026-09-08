// Local, read-only preview of the real production build. No credentials, email,
// payments, CRM mutations or remote database are used by this server.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import snapshot from '../shared/publishedPricebookSnapshot.js';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.argv[2]) || 8768;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
createServer(async (req, res) => {
  const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(body); };
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (req.method !== 'GET') return send(503, JSON.stringify({ error: 'This local review cannot send requests or change bookings.' }));
    if (pathname === '/api/website-pricebook') return send(200, JSON.stringify(snapshot));
    if (pathname.startsWith('/api/')) return send(503, JSON.stringify({ error: 'This local review has no connection to private booking data.' }));
    let filename = path.resolve(root, `.${pathname}`);
    if (filename !== root && !filename.startsWith(root + path.sep)) return send(403, '{}');
    try { if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html'); }
    catch { filename += '.html'; }
    try { return send(200, await readFile(filename), mime[path.extname(filename)] || 'application/octet-stream'); }
    catch { return send(404, await readFile(path.join(root, '404.html')), 'text/html; charset=utf-8'); }
  } catch { return send(400, '{}'); }
}).listen(port, '127.0.0.1', () => console.log(`Read-only website review: http://127.0.0.1:${port}`));
