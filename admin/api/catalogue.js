import { verifyAdminRequest } from './_lib/adminAuth.js';
import { corsHeaders } from './_lib/cors.js';
import { getServiceClient } from './_lib/supabaseAdmin.js';
import { readJsonBody } from './_lib/body.js';
import { sanitiseFreeTextFilter, isValidUuid } from './_lib/normalise.js';
import {
  CATALOGUE_ITEM_TYPE_VALUES, CATALOGUE_STATUS_VALUES,
  validateCatalogueItemInput, toCatalogueItem,
} from './_lib/catalogueFields.js';
import { CATALOGUE_SEED_ITEMS } from './_lib/catalogueSeed.js';

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 16 * 1024;
const MAX_LIST_ROWS = 200; // a small-business catalogue; hard cap, not pagination
const ITEM_SELECT = 'id, name, description, default_price_pence, item_type, category, status, created_at, updated_at';

// Products & Services catalogue — admin-only reusable invoice line items.
//
// ONE consolidated literal route file, deliberately: the admin Vercel
// project is hard-capped at 12 serverless functions and was at 12/12 before
// this feature, so this route exists as a single file with method +
// query-string dispatch (the same proven pattern as
// admin/api/bookings/[id].js's ?action=status/notes), and its function
// slot was freed by folding admin/api/bookings/[id]/notes.js into
// admin/api/bookings/[id].js. Catch-all bracket routing ([...x]) is
// confirmed broken on this project's Vercel router and is never used here
// (see admin/INVOICES_SETUP.md "Vercel function count" for the history).
//
//   GET   /api/catalogue?status=active|archived&type=service|product&q=...
//   POST  /api/catalogue                  — create an item
//   POST  /api/catalogue?action=seed      — explicit one-off import of the
//                                           site's published price list
//                                           (_lib/catalogueSeed.js); skips
//                                           names that already exist
//   PATCH /api/catalogue?id=<uuid>        — edit fields and/or archive or
//                                           reactivate via { status }
// There is no DELETE: items are archived, never removed, so an invoice
// created from an item always keeps meaning ("Test item" rows aside, the
// catalogue is an append-and-archive list).
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  const action = new URL(req.url, 'https://x').searchParams.get('action');
  if (action === 'seed') return handleSeed(req, res, headers);

  if (req.method === 'GET') return handleList(req, res, headers);
  if (req.method === 'POST') return handleCreate(req, res, headers);
  if (req.method === 'PATCH') return handleUpdate(req, res, headers);

  res.writeHead(405, headers);
  return res.end(JSON.stringify({ error: 'Method not allowed' }));
}

async function handleList(req, res, headers) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const params = new URL(req.url, 'https://x').searchParams;

  const status = params.get('status') || 'active';
  if (!CATALOGUE_STATUS_VALUES.includes(status)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `status must be one of: ${CATALOGUE_STATUS_VALUES.join(', ')}` }));
  }

  const type = params.get('type') || null;
  if (type && !CATALOGUE_ITEM_TYPE_VALUES.includes(type)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: `type must be one of: ${CATALOGUE_ITEM_TYPE_VALUES.join(', ')}` }));
  }

  const rawQ = params.get('q');
  const q = rawQ ? sanitiseFreeTextFilter(rawQ) : null;
  if (rawQ && !q) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'q filter is invalid' }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    let query = supabase
      .from('catalogue_items')
      .select(ITEM_SELECT)
      .eq('status', status)
      .order('name')
      .limit(MAX_LIST_ROWS);

    if (type) query = query.eq('item_type', type);
    if (q) {
      const escaped = q.replace(/[%,]/g, '');
      query = query.or(`name.ilike.%${escaped}%,category.ilike.%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[admin/api] catalogue list query failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to load catalogue items' }));
    }

    res.writeHead(200, headers);
    res.end(JSON.stringify({ results: (data || []).map(toCatalogueItem) }));
  } catch (err) {
    console.error('[admin/api] catalogue list unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleCreate(req, res, headers) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  const validated = validateCatalogueItemInput(body);
  if (!validated.ok) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: validated.error }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data, error } = await supabase
      .from('catalogue_items')
      .insert(validated.value)
      .select(ITEM_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        res.writeHead(409, headers);
        return res.end(JSON.stringify({ error: 'An item with this name already exists' }));
      }
      console.error('[admin/api] catalogue insert failed:', error.code, error.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to save catalogue item' }));
    }

    console.log('[admin/api] catalogue item created | id:', data.id, '| admin:', auth.admin.id);

    res.writeHead(201, headers);
    res.end(JSON.stringify(toCatalogueItem(data)));
  } catch (err) {
    console.error('[admin/api] catalogue create unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleUpdate(req, res, headers) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const id = new URL(req.url, 'https://x').searchParams.get('id');
  if (!id || !isValidUuid(id)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'id must be a valid UUID' }));
  }

  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
  }

  const validated = validateCatalogueItemInput(body, { partial: true });
  if (!validated.ok) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: validated.error }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data, error } = await supabase
      .from('catalogue_items')
      .update(validated.value)
      .eq('id', id)
      .select(ITEM_SELECT)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        res.writeHead(409, headers);
        return res.end(JSON.stringify({ error: 'An item with this name already exists' }));
      }
      console.error('[admin/api] catalogue update failed:', error.code, error.message, '| id:', id, '| admin:', auth.admin.id);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to update catalogue item' }));
    }

    if (!data) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: 'Catalogue item not found' }));
    }

    console.log('[admin/api] catalogue item updated | id:', id, '| admin:', auth.admin.id);

    res.writeHead(200, headers);
    res.end(JSON.stringify(toCatalogueItem(data)));
  } catch (err) {
    console.error('[admin/api] catalogue update unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// Explicit, admin-clicked seed of the site's published price list
// (_lib/catalogueSeed.js — every price transcribed from the repo's verified
// pricing constants). Idempotent: names already in the catalogue (any
// status, matched case-insensitively via the lower(name) unique index) are
// skipped, never overwritten — an admin's own edits to a seeded item are
// never clobbered by re-running the import.
async function handleSeed(req, res, headers) {
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }

  const supabase = getServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Server misconfiguration' }));
  }

  try {
    const { data: existing, error: listErr } = await supabase
      .from('catalogue_items')
      .select('name');
    if (listErr) {
      console.error('[admin/api] catalogue seed lookup failed:', listErr.code, listErr.message);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: 'Failed to check existing catalogue items' }));
    }

    const existingNames = new Set((existing || []).map((row) => row.name.toLowerCase()));
    const toInsert = CATALOGUE_SEED_ITEMS.filter((item) => !existingNames.has(item.name.toLowerCase()));
    const skipped = CATALOGUE_SEED_ITEMS.length - toInsert.length;

    let inserted = 0;
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('catalogue_items')
        .insert(toInsert)
        .select('id');
      if (error) {
        console.error('[admin/api] catalogue seed insert failed:', error.code, error.message);
        res.writeHead(500, headers);
        return res.end(JSON.stringify({ error: 'Failed to import the standard price list' }));
      }
      inserted = (data || []).length;
    }

    console.log('[admin/api] catalogue seeded | inserted:', inserted, '| skipped:', skipped, '| admin:', auth.admin.id);

    res.writeHead(200, headers);
    res.end(JSON.stringify({ inserted, skipped }));
  } catch (err) {
    console.error('[admin/api] catalogue seed unexpected error:', err?.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
