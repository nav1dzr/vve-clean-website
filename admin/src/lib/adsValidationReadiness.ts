import { supabase } from './supabase';
import { parseReadinessResult, type ReadinessResult } from '../../shared/adsValidationReadiness.js';

// Diagnostic-only GET: ordinary API error handling is deliberately unchanged.
// Never accepts a URL, method, body or retry option from the caller.
export async function getAdsValidationReadiness(): Promise<ReadinessResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 'denied' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('/api/admin-ads-validation', {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
      redirect: 'error', signal: controller.signal,
    });
    return parseReadinessResult(await response.json(), response.status);
  } finally { clearTimeout(timeout); }
}

export function readinessMessage(result: ReadinessResult): string {
  const messages = {
    GUARD_CHANGED: 'A safety check changed during readiness. Validation remains closed.',
    CLAIM_STORE_UNAVAILABLE: 'The Website diagnostic claim store is unavailable. No validation was requested.',
    CLAIM_LOOKUP_FAILED: 'The Website could not check the existing diagnostic claim. No validation was requested.',
    FORWARD_REQUEST_FAILED: 'The CRM could not complete its readiness request to the Website. No validation was requested.',
    FORWARD_RESPONSE_INVALID: 'The CRM could not verify the Website readiness response. No validation was requested.',
    UPSTREAM_CLOSED: 'The Website readiness guard is closed. Its specific cause is not disclosed by this response.',
    UPSTREAM_DENIED: 'The Website refused the readiness request. Check the approved access and request requirements.',
    UPSTREAM_UNAVAILABLE: 'Website readiness is unavailable. The response does not establish a specific cause.',
  };
  if (result.reason) return messages[result.reason];
  if (result.status === 'ready') return 'The window is open. Only the authorised operator may run this check.';
  if (result.status === 'consumed') return 'This attempt has already been consumed. Do not repeat it.';
  if (result.status === 'denied') return 'Readiness access was denied. No validation was requested from this page.';
  if (result.status === 'closed') return 'Validation is closed. The safety gate does not disclose its specific cause.';
  return 'Readiness is unavailable or uncertain. No validation was requested from this page.';
}
