import { verifyAdminRequest } from './adminAuth.js';
import { getServiceClient } from './supabaseAdmin.js';
import { corsHeaders } from './cors.js';
import { readJsonBody } from './body.js';
import {
  PRICEBOOK_VERSIONS_TABLE, PRICEBOOK_PUBLICATIONS_TABLE,
  validatePricebookDraft, previewWebsitePricebook,
  pricebookRefreshConfigured, requestPricebookRefresh,
} from './websitePricebook.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionFields = 'id,label,overrides,created_at,published_at';

export async function websitePricebookHandler(req, res) {
  const headers = { ...corsHeaders(req.headers.origin || ''), 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  const send = (status, body) => { res.writeHead(status, headers); return res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
  if (!['GET','POST'].includes(req.method)) return send(405, { error: 'Method not allowed' });
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return send(auth.status, { error: auth.error });
  const supabase = getServiceClient();
  if (!supabase) return send(503, { error: 'The price list service is not configured.' });
  try {
    if (req.method === 'GET') {
      const [current, versions, publications] = await Promise.all([
        supabase.rpc('get_published_website_pricebook'),
        supabase.from(PRICEBOOK_VERSIONS_TABLE).select(versionFields).order('created_at', { ascending: false }).limit(30),
        supabase.from(PRICEBOOK_PUBLICATIONS_TABLE).select('id,version_id,created_at,refresh_status').order('created_at', { ascending: false }).limit(10),
      ]);
      if (current.error || versions.error || publications.error || !current.data) return send(503, { error: 'Website price lists are not ready. Check the pricebook migration and database connection.' });
      return send(200, { current: current.data, versions: versions.data, publications: publications.data, refreshReady: pricebookRefreshConfigured(), ...previewWebsitePricebook(current.data.overrides) });
    }
    let body;
    try { body = await readJsonBody(req, 32768); } catch { return send(400, { error: 'Invalid or oversized request.' }); }
    if (body.action === 'preview' || body.action === 'save-draft') {
      const checked = validatePricebookDraft(body);
      if (!checked.ok) return send(400, { error: checked.error });
      const preview = previewWebsitePricebook(checked.value.overrides);
      if (body.action === 'preview') return send(200, preview);
      const { data, error } = await supabase.from(PRICEBOOK_VERSIONS_TABLE).insert({ ...checked.value, created_by: auth.admin.id }).select(versionFields).single();
      if (error) return send(503, { error: 'Could not save the draft. No price was published.' });
      return send(201, { draft: data, ...preview });
    }
    if (body.action === 'retry-refresh') {
      if (!pricebookRefreshConfigured()) return send(409, { error: 'Connect the website snapshot refresh before publishing.' });
      if (!UUID.test(body.publicationId || '')) return send(400, { error: 'Select a valid publication.' });
      const { data, error } = await supabase.from(PRICEBOOK_PUBLICATIONS_TABLE).select('id').eq('id', body.publicationId).maybeSingle();
      if (error || !data) return send(404, { error: 'Publication not found.' });
      return send(200, { refresh: await requestPricebookRefresh(data.id, supabase) });
    }
    if (!['publish','rollback'].includes(body.action)) return send(400, { error: 'Unknown price list action.' });
    if (!pricebookRefreshConfigured()) return send(409, { error: 'Publishing needs the website snapshot refresh connection. Drafts and previews are available now.' });
    if (!UUID.test(body.versionId || '')) return send(400, { error: 'Select a saved price list.' });
    const expected = body.expectedVersionId === 'bundled' || body.expectedVersionId === null ? null : body.expectedVersionId;
    if (expected !== null && !UUID.test(expected || '')) return send(400, { error: 'Reload the current published version before continuing.' });
    const { data: selected, error: readError } = await supabase.from(PRICEBOOK_VERSIONS_TABLE).select(versionFields).eq('id', body.versionId).maybeSingle();
    if (readError || !selected) return send(404, { error: 'Saved price list not found.' });
    const checked = validatePricebookDraft(selected);
    if (!checked.ok) return send(400, { error: checked.error });
    let versionId = selected.id;
    if (body.action === 'rollback') {
      const { data, error } = await supabase.from(PRICEBOOK_VERSIONS_TABLE).insert({ label: `Restore: ${selected.label}`.slice(0,120), overrides: selected.overrides, created_by: auth.admin.id }).select('id').single();
      if (error) return send(503, { error: 'Could not prepare the restore. Published prices are unchanged.' });
      versionId = data.id;
    }
    const { data: publication, error } = await supabase.rpc('publish_website_pricebook', { p_version_id: versionId, p_expected_version_id: expected, p_admin_id: auth.admin.id });
    if (error) {
      if (String(error.message).includes('PRICEBOOK_CONFLICT')) return send(409, { error: 'Another price list was published while you were reviewing. Reload and review the current prices.' });
      return send(503, { error: 'Publication could not be confirmed. Reload the price lists before trying again.' });
    }
    const refresh = await requestPricebookRefresh(publication.publicationId, supabase);
    return send(200, { publication, refresh, message: refresh.status === 'requested' ? 'Prices published for new interactive visits. The search-page snapshot refresh was requested; confirm the website build completes.' : 'Prices published for new interactive visits, but the search-page snapshot refresh failed. Retry the refresh below.' });
  } catch (error) {
    console.error('[website-pricebook] request failed', error?.message);
    return send(503, { error: 'Could not complete the price list request. Reload before retrying.' });
  }
}
