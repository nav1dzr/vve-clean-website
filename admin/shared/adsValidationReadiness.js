// Shared, value-free readiness wire contract. No environment, account or token
// values belong here. Servers may add a reason only AFTER admin verification.
const REASONS = Object.freeze({
  'website:GUARD_CHANGED': ['closed', 403],
  'website:CLAIM_STORE_UNAVAILABLE': ['unavailable', 503],
  'website:CLAIM_LOOKUP_FAILED': ['unavailable', 503],
  'crm:GUARD_CHANGED': ['closed', 403],
  'crm:FORWARD_REQUEST_FAILED': ['unavailable', 503],
  'crm:FORWARD_RESPONSE_INVALID': ['unavailable', 503],
  'crm:UPSTREAM_CLOSED': ['closed', 403],
  'crm:UPSTREAM_DENIED': ['denied', 400, 401, 403],
  'crm:UPSTREAM_UNAVAILABLE': ['unavailable', 503],
});
const GENERIC = Object.freeze({ ready: [200], consumed: [200], closed: [403],
  denied: [400, 401, 403], unavailable: [503], uncertain: [503] });

export function readinessFailure(stage, reason) {
  const definition = REASONS[`${stage}:${reason}`];
  if (!definition) throw new Error('invalid_readiness_reason');
  return { status: definition[0], stage, reason };
}

export function parseReadinessResult(body, httpStatus) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.status !== 'string' || !Object.hasOwn(GENERIC, body.status))
    throw new Error('invalid_readiness_result');
  const keys = Object.keys(body);
  if (keys.length === 1 && GENERIC[body.status].includes(httpStatus)) return { status: body.status };
  if (keys.length !== 3 || keys.some(key => !['status', 'stage', 'reason'].includes(key)) ||
      typeof body.stage !== 'string' || typeof body.reason !== 'string') throw new Error('invalid_readiness_result');
  const definition = REASONS[`${body.stage}:${body.reason}`];
  if (!definition || definition[0] !== body.status || !definition.slice(1).includes(httpStatus))
    throw new Error('invalid_readiness_result');
  return { status: body.status, stage: body.stage, reason: body.reason };
}
