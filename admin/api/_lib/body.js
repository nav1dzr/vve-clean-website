// Shared raw-body reader for routes declaring `bodyParser: false`. Search
// queries are short, so the default cap is deliberately small — protects
// against memory exhaustion from an oversized request body. Callers with a
// legitimately larger payload (e.g. an invoice editor submitting many line
// items) pass an explicit, still-bounded maxBytes rather than this
// function growing an unbounded default.
const MAX_BODY_BYTES = 8 * 1024; // 8 KB

export async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  const raw = await new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy(new Error('Request body too large'));
        reject(new Error('Request body too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}
