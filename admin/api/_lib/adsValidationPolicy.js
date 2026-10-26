import { createHash } from 'node:crypto';
import { ADS_VALIDATION_BINDING } from './adsValidationBinding.js';
import { ADS_VALIDATION_SOURCE_SHA256 } from './adsValidationManifest.js';

export const PLAN_ID = 'VVE-20261025-PRIVATE-MEASUREMENT-VALIDATION-V1';
export const PLAN_SHA256 = 'e78e7d2dfcf3b94fb1852d89f4af883cc25b5769120723a13999af0d86394c8e';
export const SCOPE_APPROVAL_SHA256 = 'dfb01f5390ef48587d48867f901d5595789d8d4a6d30780a1ab780b33f6970af';
export const VALIDATION_PATH = '/api/admin-ads-validation';
export const ADMIN_ORIGIN = 'https://admin.vveclean.co.uk';
export const WEBSITE_ENDPOINT = `https://www.vveclean.co.uk${VALIDATION_PATH}`;
export const CLAIM_TABLE = 'ads_validation_attempts';
const SHA = /^[a-f0-9]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const RESPONSE_HEADERS = Object.freeze({
  'Content-Type': 'application/json', 'Cache-Control': 'no-store, private',
  'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
});

// All values are synthetic schema fixtures, never representations of customers
// or genuine consent. Timestamp is replaced with the separately approved start.
export function validationPayload(timestamp = '__APPROVED_START_UTC__') {
  return {
    destinations: [{ operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '5569099303' },
      loginAccount: { accountType: 'GOOGLE_ADS', accountId: '2421356882' }, productDestinationId: '7793447505' }],
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_GRANTED' },
    events: [{ adIdentifiers: { gclid: 'VVE-SYNTHETIC-VALIDATION-NOT-A-REAL-CLICK' },
      conversionValue: 30, currency: 'GBP', eventTimestamp: timestamp,
      transactionId: PLAN_ID, eventSource: 'WEB' }],
    validateOnly: true,
  };
}
export const PAYLOAD_TEMPLATE_SHA256 = createHash('sha256').update(JSON.stringify(validationPayload())).digest('hex');

export function validationOpen(env = process.env, binding = ADS_VALIDATION_BINDING,
  now = Date.now(), sourceHash = ADS_VALIDATION_SOURCE_SHA256) {
  if (env.VERCEL_ENV !== 'production' || env.BOOKING_MEASUREMENT_MODE !== 'disabled' ||
      !SHA.test(sourceHash || '') || binding.sourceManifestSha256 !== sourceHash ||
      !SHA.test(binding.executionAuthoritySha256 || '') ||
      !ISO.test(binding.startsAt || '') || !ISO.test(binding.endsAt || '')) return false;
  const start = Date.parse(binding.startsAt); const end = Date.parse(binding.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString() !== binding.startsAt ||
      new Date(end).toISOString() !== binding.endsAt || end <= start || end - start > 1800000 || now < start || now >= end) return false;
  const exact = 'https://temlphabsqukkiqmrvhl.supabase.co';
  return [exact, `${exact}/`].includes(env.VITE_SUPABASE_URL) &&
    (!env.SUPABASE_URL || [exact, `${exact}/`].includes(env.SUPABASE_URL)) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}

export function validationDispatch(req) {
  try {
    const url = new URL(req.url || '/', 'https://invalid.local');
    return url.pathname.startsWith(VALIDATION_PATH) || url.searchParams.getAll('resource').includes('admin-ads-validation');
  } catch { return false; }
}

export function validValidationRequest(req, internalPath, host) {
  const trustedOrigin = req.headers?.origin === ADMIN_ORIGIN ||
    (req.method === 'GET' && internalPath === '/api/me' && !req.headers?.origin && req.headers?.['sec-fetch-site'] === 'same-origin');
  if (!['GET', 'POST'].includes(req.method) || req.headers?.host !== host ||
      !trustedOrigin || typeof req.url !== 'string' || !req.url.startsWith('/') || req.url.startsWith('//')) return false;
  // Match raw paths, not URL-normalised aliases, fragments or dot segments.
  const exactRoute = req.url === VALIDATION_PATH;
  const exactRewrite = req.url === `${internalPath}?resource=admin-ads-validation`;
  const token = req.headers.authorization;
  return (exactRoute || exactRewrite) && typeof token === 'string' && /^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(token) &&
    (req.method === 'GET' || req.headers['content-type'] === 'application/json');
}

export async function validationBody(req) {
  if (req.method === 'GET') return !req.headers['transfer-encoding'] &&
    (req.headers['content-length'] === undefined || req.headers['content-length'] === '0') &&
    (req.body === undefined || req.body === null || req.body === '');
  let raw = '';
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 256) return false;
  }
  if (Buffer.byteLength(raw) > 256) return false;
  const body = JSON.parse(raw);
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 1 && body.planId === PLAN_ID;
}

// Documented events.ingest JSON schema. An empty parsed object is valid for
// validateOnly; a swallowed parse error, null/array or error-shaped 200 is not.
export function validationResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['requestId', 'fieldWarnings'].includes(key)) ||
      ('requestId' in body && (typeof body.requestId !== 'string' || !body.requestId.trim() || body.requestId.length > 300)) ||
      ('fieldWarnings' in body && (!Array.isArray(body.fieldWarnings) || body.fieldWarnings.some(w =>
        !w || typeof w !== 'object' || Array.isArray(w) ||
        Object.keys(w).some(key => !['field', 'description', 'reason'].includes(key)) ||
        Object.values(w).some(value => typeof value !== 'string'))))) throw new Error('invalid_response');
  return { status: 'validated', warningCount: body.fieldWarnings?.length || 0 };
}

export function safeTransportResult(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_result');
  if (['closed', 'denied', 'ready', 'consumed', 'unavailable', 'uncertain'].includes(body.status) &&
      Object.keys(body).length === 1) return { status: body.status };
  if (body.status === 'validated' && Number.isSafeInteger(body.warningCount) && body.warningCount >= 0 &&
      Object.keys(body).length === 2) return { status: 'validated', warningCount: body.warningCount };
  throw new Error('invalid_result');
}
