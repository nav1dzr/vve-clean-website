import { verifyAdminRequest } from '../../_lib/adminAuth.js';
import { corsHeaders } from '../../_lib/cors.js';
import { getServiceClient } from '../../_lib/supabaseAdmin.js';
import { isValidUuid, validateNote } from '../../_lib/normalise.js';
import { extractIdParam } from '../../_lib/routeParams.js';
import { readJsonBody } from '../../_lib/body.js';
import { toNote } from '../../_lib/bookingFields.js';

export const config = { api: { bodyParser: false } };

const NOTE_SELECT = 'id, note, created_at, author:admin_users(id, display_name)';

// GET  /api/bookings/:id/notes  — list, newest first.
// POST /api/bookings/:id/notes  — append a note. Append-only: there is no
// PATCH/DELETE route for this table in version one (ADMIN_CRM_PLAN.md 20).
//
// The author is always the authenticated caller's own admin id
// (auth.admin.id) — a browser-supplied author id in the request body is
// never read or trusted.
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const bookingId = extractIdParam(req, 1);
  if (!isValidUuid(bookingId)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Invalid booking id' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingErr) {
      console.error('[admin/api] notes: booking lookup failed:', bookingErr.code, bookingErr.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load booking' }));
    }

    if (!booking) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Booking not found' }));
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('internal_notes')
        .select(NOTE_SELECT)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[admin/api] notes list failed:', error.code, error.message);
        res.writeHead(500, headers);
        return res.end(JSON.stringify({ error: 'Failed to load notes' }));
      }

      res.writeHead(200, headers);
      return res.end(JSON.stringify({ notes: (data || []).map(toNote) }));
    }

    // POST
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
    }

    const validated = validateNote(body.note);
    if (!validated.ok) {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ error: validated.error }));
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('internal_notes')
      .insert({
        booking_id: bookingId,
        author_admin_id: auth.admin.id,
        note: validated.value,
      })
      .select(NOTE_SELECT)
      .single();

    if (insertErr) {
      console.error('[admin/api] note insert failed:', insertErr.code, insertErr.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to save note' }));
    }

    console.log('[admin/api] note added | booking:', bookingId, '| admin:', auth.admin.id);

    res.writeHead(201, headers);
    res.end(JSON.stringify(toNote(inserted)));
  } catch (err) {
    console.error('[admin/api] notes unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
