export type ReadinessStatus = 'ready' | 'consumed' | 'closed' | 'denied' | 'unavailable' | 'uncertain';
export type ReadinessReason = 'GUARD_CHANGED' | 'CLAIM_STORE_UNAVAILABLE' | 'CLAIM_LOOKUP_FAILED' |
  'FORWARD_REQUEST_FAILED' | 'FORWARD_RESPONSE_INVALID' | 'UPSTREAM_CLOSED' | 'UPSTREAM_DENIED' | 'UPSTREAM_UNAVAILABLE';
export type ReadinessResult = { status: ReadinessStatus; stage?: 'website' | 'crm'; reason?: ReadinessReason };
export function readinessFailure(stage: 'website' | 'crm', reason: ReadinessReason): ReadinessResult;
export function parseReadinessResult(body: unknown, httpStatus: number): ReadinessResult;
