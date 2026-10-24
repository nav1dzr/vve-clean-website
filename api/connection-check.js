import { verifyAdminRequest } from '../admin/api/_lib/adminAuth.js';
import { CHECK_WINDOW, CheckError, assertClosedGuards, validateRequest, authorised, createLimiter,
  projectRef, refreshOnly, reply, fail } from '../admin/api/_lib/connectionCheck.js';
export const config = { api: { bodyParser: false } };
export function createWebsiteCheck({ env = process.env, now = Date.now, window = CHECK_WINDOW,
  verify = verifyAdminRequest, fetchFn = fetch } = {}) {
  const reserve = createLimiter();
  return async (req, res) => {
    let release;
    try {
      assertClosedGuards(env, window, now());
      await validateRequest(req, { browser: false });
      const id = await authorised(req, verify);
      const databaseRef = projectRef(env.VITE_SUPABASE_URL);
      if (!databaseRef) throw new CheckError(503, 'database_reference_unavailable');
      assertClosedGuards(env, window, now());
      release = reserve(id, now());
      const result = await refreshOnly(env, fetchFn);
      return reply(res, 200, { runtime: 'website', databaseRef,
        contactDatabaseRef: projectRef(env.SUPABASE_URL || env.VITE_SUPABASE_URL), ...result });
    } catch (error) { return fail(res, error); }
    finally { release?.(); }
  };
}
export default createWebsiteCheck();
