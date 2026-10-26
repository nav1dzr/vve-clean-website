import { verifyAdminRequest } from './adminAuth.js';
import { ADS_VALIDATION_BINDING } from './adsValidationBinding.js';
import { ADS_VALIDATION_SOURCE_SHA256 } from './adsValidationManifest.js';
import { parseReadinessResult, readinessFailure } from '../../shared/adsValidationReadiness.js';
import { ADMIN_ORIGIN, WEBSITE_ENDPOINT, PLAN_ID, RESPONSE_HEADERS,
  validationOpen, validValidationRequest, validationBody, safeTransportResult } from './adsValidationPolicy.js';

export function createAdsValidationForward({ env = process.env, binding = ADS_VALIDATION_BINDING,
  sourceHash = ADS_VALIDATION_SOURCE_SHA256, now = () => Date.now(),
  authenticate = verifyAdminRequest, fetchImpl = fetch } = {}) {
  const open = () => validationOpen(env, binding, now(), sourceHash);
  return async (req, res) => {
    const send = (code, body) => { res.writeHead(code, RESPONSE_HEADERS); res.end(JSON.stringify(body)); };
    let authenticated = false;
    let responseReceived = false;
    try {
      if (!open()) return send(403, { status: 'closed' });
      if (!validValidationRequest(req, '/api/me', 'admin.vveclean.co.uk') || !await validationBody(req))
        return send(400, { status: 'denied' });
      const auth = await authenticate(req, { redactErrors: true });
      if (auth?.ok !== true) return send(auth?.status === 401 ? 401 : 403, { status: 'denied' });
      authenticated = true;
      if (!open()) return send(403, req.method === 'GET' ? readinessFailure('crm', 'GUARD_CHANGED') : { status: 'closed' });
      const response = await fetchImpl(WEBSITE_ENDPOINT, {
        method: req.method, redirect: 'error', signal: AbortSignal.timeout(19000),
        headers: { authorization: req.headers.authorization, origin: ADMIN_ORIGIN,
          ...(req.method === 'POST' ? { 'content-type': 'application/json' } : {}) },
        ...(req.method === 'POST' ? { body: JSON.stringify({ planId: PLAN_ID }) } : {}),
      });
      responseReceived = true;
      if (req.method === 'GET') {
        const body = parseReadinessResult(await response.json(), response.status);
        if (response.ok !== (response.status >= 200 && response.status < 300) ||
            (body.stage && body.stage !== 'website')) throw new Error('invalid_readiness_response');
        if (!open()) return send(403, readinessFailure('crm', 'GUARD_CHANGED'));
        if (!body.stage && ['closed', 'denied', 'unavailable'].includes(body.status)) {
          const reason = { closed: 'UPSTREAM_CLOSED', denied: 'UPSTREAM_DENIED', unavailable: 'UPSTREAM_UNAVAILABLE' }[body.status];
          return send(response.status, readinessFailure('crm', reason));
        }
        return send(response.status, body);
      }
      const body = safeTransportResult(await response.json());
      if (!response.ok || (req.method === 'GET' ? !['ready', 'consumed'].includes(body.status) : body.status !== 'validated'))
        return send(response.status >= 400 && response.status <= 599 ? response.status : 503,
          { status: ['closed', 'denied', 'consumed', 'unavailable'].includes(body.status) ? body.status : 'uncertain' });
      return send(200, body);
    } catch {
      if (req.method === 'GET' && authenticated) return send(503,
        readinessFailure('crm', responseReceived ? 'FORWARD_RESPONSE_INVALID' : 'FORWARD_REQUEST_FAILED'));
      return send(503, { status: 'uncertain' });
    }
  };
}
export default createAdsValidationForward();
