import { verifyAdminRequest } from '../../admin/api/_lib/adminAuth.js';
import { getServiceClient } from '../../admin/api/_lib/supabaseAdmin.js';
import { ADS_VALIDATION_BINDING } from '../../admin/api/_lib/adsValidationBinding.js';
import { ADS_VALIDATION_SOURCE_SHA256 } from '../../admin/api/_lib/adsValidationManifest.js';
import { CLAIM_TABLE, PLAN_ID, PAYLOAD_TEMPLATE_SHA256, RESPONSE_HEADERS,
  validationOpen, validValidationRequest, validationBody, validationPayload,
  validationResponse } from '../../admin/api/_lib/adsValidationPolicy.js';

const TOKEN = 'https://oauth2.googleapis.com/token';
const INGEST = 'https://datamanager.googleapis.com/v1/events:ingest';
function googleConfigured(env) {
  return env.GOOGLE_ADS_CUSTOMER_ID === '5569099303' && env.GOOGLE_ADS_LOGIN_CUSTOMER_ID === '2421356882' &&
    env.GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID === '7793447505' &&
    ['GOOGLE_DATA_MANAGER_CLIENT_ID', 'GOOGLE_DATA_MANAGER_CLIENT_SECRET', 'GOOGLE_DATA_MANAGER_REFRESH_TOKEN']
      .every(key => typeof env[key] === 'string' && env[key].length > 0);
}

// Dependencies are supplied only by local mocks, never by HTTP input. No worker,
// customer, payment, notification or conversion-outbox modules are imported.
export function createPrivateAdsValidation({ env = process.env, binding = ADS_VALIDATION_BINDING,
  sourceHash = ADS_VALIDATION_SOURCE_SHA256, now = () => Date.now(),
  authenticate = verifyAdminRequest, database = getServiceClient, fetchImpl = fetch } = {}) {
  const open = () => validationOpen(env, binding, now(), sourceHash) && googleConfigured(env);
  return async (req, res) => {
    const send = (code, status) => { res.writeHead(code, RESPONSE_HEADERS); res.end(JSON.stringify(status)); };
    let consumed = false;
    try {
      if (!open()) return send(403, { status: 'closed' });
      if (!validValidationRequest(req, '/api/booking-management', 'www.vveclean.co.uk') || !await validationBody(req))
        return send(400, { status: 'denied' });
      const auth = await authenticate(req, { redactErrors: true });
      if (!auth.ok) return send(auth.status === 401 ? 401 : 403, { status: 'denied' });
      if (!open()) return send(403, { status: 'closed' });
      const db = database();
      if (!db) return send(503, { status: 'unavailable' });
      if (req.method === 'GET') {
        const { data, error } = await db.from(CLAIM_TABLE).select('plan_id').eq('plan_id', PLAN_ID).maybeSingle();
        if (error) return send(503, { status: 'unavailable' });
        return send(200, { status: data ? 'consumed' : 'ready' });
      }
      if (!open()) return send(403, { status: 'closed' });
      // Single unique INSERT: no upsert, update, delete, lease or reclaim. A DB
      // timeout may have committed, so it never permits any provider attempt.
      consumed = true;
      const { data, error } = await db.from(CLAIM_TABLE).insert({
        plan_id: PLAN_ID, source_sha256: sourceHash, payload_sha256: PAYLOAD_TEMPLATE_SHA256,
        authority_sha256: binding.executionAuthoritySha256,
        approved_start: binding.startsAt, approved_end: binding.endsAt,
      }).select('plan_id').single();
      if (error || data?.plan_id !== PLAN_ID) return send(409, { status: 'consumed' });
      if (!open()) return send(409, { status: 'consumed' });
      const payload = validationPayload(binding.startsAt);
      const expected = JSON.stringify(payload);
      if (!open()) return send(409, { status: 'consumed' });
      const tokenResponse = await fetchImpl(TOKEN, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        body: new URLSearchParams({ client_id: env.GOOGLE_DATA_MANAGER_CLIENT_ID,
          client_secret: env.GOOGLE_DATA_MANAGER_CLIENT_SECRET,
          refresh_token: env.GOOGLE_DATA_MANAGER_REFRESH_TOKEN, grant_type: 'refresh_token' }),
      });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token || typeof token !== 'object' || Array.isArray(token) ||
          Object.hasOwn(token, 'error') || typeof token.access_token !== 'string' ||
          !/^[A-Za-z0-9._~+/-]{1,8192}$/.test(token.access_token)) throw new Error('oauth_failed');
      // Recheck the closed/window/mode/account guards after OAuth. Never retry.
      if (!open()) return send(409, { status: 'consumed' });
      if (payload.validateOnly !== true || payload.events.length !== 1 || payload.destinations.length !== 1 ||
          JSON.stringify(validationPayload(binding.startsAt)) !== expected) throw new Error('payload_changed');
      const response = await fetchImpl(INGEST, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: expected,
      });
      // Parse here, never use shared adapter's parse-error-to-empty fallback.
      const body = await response.json();
      if (!response.ok) throw new Error('validation_failed');
      return send(200, validationResponse(body));
    } catch {
      // Do not log raw auth/DB/provider errors or expose provider response bodies.
      return send(503, { status: consumed ? 'uncertain' : 'unavailable' });
    }
  };
}

export default createPrivateAdsValidation();
