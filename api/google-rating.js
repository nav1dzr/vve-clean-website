/** Public aggregate only. No reviews, customer records or browser Google scripts. */
export default async function handler(req, res) {
  const send = (status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...(status === 405 ? { Allow: 'GET' } : {}),
    });
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const place = process.env.GOOGLE_PLACES_PLACE_ID;
  if (process.env.GOOGLE_RATING_ENABLED !== 'true' || !key || !place || !/^[A-Za-z0-9_-]{10,200}$/.test(place)) return send(200, { rating: null });
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${place}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,attributions' },
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return send(503, { rating: null });
    const data = await response.json();
    if (!data || typeof data.rating !== 'number' || !Number.isFinite(data.rating) || data.rating < 1 || data.rating > 5
      || !Number.isSafeInteger(data.userRatingCount) || data.userRatingCount < 1) return send(503, { rating: null });
    // This compact integration supports Google's own aggregate. If additional
    // provider credits are required, keep the dated fallback instead of dropping
    // those credits. Supporting third-party content needs an attributed layout.
    if (data.attributions !== undefined && (!Array.isArray(data.attributions) || data.attributions.length > 0)) return send(503, { rating: null });
    return send(200, { rating: { value: data.rating, count: data.userRatingCount, verifiedOn: new Date().toISOString(), live: true } });
  } catch { return send(503, { rating: null }); }
}
