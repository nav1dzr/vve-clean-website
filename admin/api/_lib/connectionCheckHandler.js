import { verifyAdminRequest } from './adminAuth.js';
import { CHECK_WINDOW, WEBSITE_CHECK_URL, CheckError, assertClosedGuards, validateRequest, authorised,
  createLimiter, projectRef, sanitiseWebsiteResult, reply, fail } from './connectionCheck.js';
export const config = { api: { bodyParser: false } };
export function createCrmCheck({ env = process.env, now = Date.now, window = CHECK_WINDOW,
  verify = verifyAdminRequest, fetchFn = fetch } = {}) {
  const reserve = createLimiter();
  return async (req, res) => {
    let release;
    try {
      assertClosedGuards(env, window, now());
      const bearer = await validateRequest(req, { browser: true });
      const id = await authorised(req, verify);
      const databaseRef = projectRef(env.VITE_SUPABASE_URL);
      if (!databaseRef) throw new CheckError(503, 'database_reference_unavailable');
      assertClosedGuards(env, window, now());
      release = reserve(id, now());
      let response;
      try {
        response = await fetchFn(WEBSITE_CHECK_URL, { method: 'POST', redirect: 'error',
          headers: { Authorization: bearer, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check' }), signal: AbortSignal.timeout(18000) });
      } catch { throw new CheckError(502, 'website_outcome_unknown'); }
      if (!response.ok || response.redirected) throw new CheckError(502, 'website_check_unavailable');
      let data;
      try { data = await response.json(); } catch { throw new CheckError(502, 'website_result_unknown'); }
      const website = sanitiseWebsiteResult(data);
      return reply(res, 200, { runtime: 'crm', databaseRef, website,
        databaseReferencesMatch: databaseRef === website.databaseRef });
    } catch (error) { return fail(res, error); }
    finally { release?.(); }
  };
}
export default createCrmCheck();
