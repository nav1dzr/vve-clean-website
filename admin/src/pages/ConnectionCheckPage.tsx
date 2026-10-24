import { useRef, useState } from 'react';
import { authFetch } from '../lib/authFetch';

interface Result {
  databaseRef: string | null;
  databaseReferencesMatch: boolean;
  website: { databaseRef: string | null; contactDatabaseRef: string | null;
    status: string; refreshSucceeded: boolean; scopeKnown: boolean; datamanagerScopePresent?: boolean };
}
function isResult(value: unknown): value is Result {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (!data.website || typeof data.website !== 'object') return false;
  const website = data.website as Record<string, unknown>;
  const ref = (v: unknown) => v === null || (typeof v === 'string' && /^[a-z0-9]{20}$/.test(v));
  const allowed = ['credentials_missing', 'refresh_rejected', 'refresh_unverified', 'refresh_succeeded', 'refresh_outcome_unknown'];
  return data.runtime === 'crm' && website.runtime === 'website' && ref(data.databaseRef) &&
    typeof data.databaseReferencesMatch === 'boolean' && ref(website.databaseRef) && ref(website.contactDatabaseRef) &&
    typeof website.status === 'string' && allowed.includes(website.status) &&
    typeof website.refreshSucceeded === 'boolean' && typeof website.scopeKnown === 'boolean' &&
    (!website.scopeKnown || typeof website.datamanagerScopePresent === 'boolean');
}
// Approved absolute UTC bounds matching server CHECK_WINDOW. No auto extension.
const OPENS_AT: string | null = '2026-10-25T00:15:00Z';
const CLOSES_AT: string | null = '2026-10-25T00:45:00Z';
export default function ConnectionCheckPage({ opensAt = OPENS_AT, closesAt = CLOSES_AT }:
  { opensAt?: string | null; closesAt?: string | null } = {}) {
  const attempted = useRef(false);
  const [started, setStarted] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [unknown, setUnknown] = useState(false);
  const start = Date.parse(opensAt || ''), end = Date.parse(closesAt || '');
  const open = end - start === 30 * 60_000 && Date.now() >= start && Date.now() < end;
  async function check() {
    if (attempted.current || !open) return;
    attempted.current = true;
    setStarted(true); setPending(true);
    try {
      const response = await authFetch<unknown>('/api/connection-check', { method: 'POST', redirect: 'error',
        body: JSON.stringify({ action: 'check' }) });
      if (!isResult(response)) { setUnknown(true); return; }
      setResult(response);
    } catch { setUnknown(true); }
    finally { setPending(false); }
  }
  return <section className="mx-auto max-w-2xl space-y-5 p-6">
    <h1 className="text-2xl font-semibold">Private connection check</h1>
    <p>Checks the server database references and Google connection only. Reporting stays off. No customer records or conversions are sent.</p>
    <p className="rounded-lg bg-slate-100 p-4">One approved manual check only. Record the invocation before pressing the button. If the result is uncertain, stop; do not reload to repeat it.</p>
    {!open && <p role="status">The check window is closed or has not been scheduled.</p>}
    <button type="button" disabled={!open || started} onClick={check}
      className="rounded-lg bg-slate-900 px-5 py-3 text-white disabled:opacity-50">
      {pending ? 'Checking connection…' : started ? 'Check requested' : 'Check connection'}
    </button>
    {unknown && <p role="alert">The result is unknown or the check was blocked. Do not repeat it. Keep reporting off and ask for the recorded result to be reviewed.</p>}
    {result && <div role="status" className="space-y-2 rounded-lg border p-4">
      <p>CRM database: {result.databaseRef || 'Unknown'}</p>
      <p>Website database: {result.website.databaseRef || 'Unknown'}</p>
      <p>Website contact database: {result.website.contactDatabaseRef || 'Unknown'}</p>
      <p>Database references: {result.databaseReferencesMatch ? 'Match' : 'Different or unknown'}</p>
      <p>Google refresh: {result.website.refreshSucceeded ? 'Succeeded' : 'Not verified'}</p>
      <p>Data Manager scope: {result.website.scopeKnown ? (result.website.datamanagerScopePresent ? 'Present' : 'Not present') : 'Unknown — Google did not return scope information'}</p>
      <p>This does not verify event ingestion or enable reporting. Do not repeat the check.</p>
    </div>}
  </section>;
}
