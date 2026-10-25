import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/authFetch';

const PLAN = 'VVE-20261025-PRIVATE-MEASUREMENT-VALIDATION-V1';
const ENDPOINT = '/api/admin-ads-validation';
const MARKER = `vve-validation-ui-attempt:${PLAN}`;
type Result = { status: string; warningCount?: number };

export default function AdsValidationPage() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Checking whether the approved window is open…');
  const used = useRef(false);
  useEffect(() => {
    let active = true;
    try { used.current = sessionStorage.getItem(MARKER) === 'consumed'; } catch { /* Server claim remains authoritative. */ }
    if (used.current) { setMessage('An attempt was already requested. Do not repeat it.'); return; }
    void authFetch<Result>(ENDPOINT).then(result => {
      if (!active) return;
      setReady(result.status === 'ready');
      setMessage(result.status === 'ready' ? 'The window is open. Only the authorised operator may run this check.' :
        result.status === 'consumed' ? 'This attempt has already been consumed. Do not repeat it.' : 'Validation is closed.');
    }).catch(() => { if (active) setMessage('Validation is closed or unavailable. No validation has been requested from this page.'); });
    return () => { active = false; };
  }, []);

  async function runOnce() {
    if (!ready || used.current) return;
    used.current = true; setReady(false);
    try { sessionStorage.setItem(MARKER, 'consumed'); } catch { /* Durable server claim protects repeats. */ }
    setMessage('One attempt requested. Do not refresh or repeat it.');
    try {
      const result = await authFetch<Result>(ENDPOINT, { method: 'POST', body: JSON.stringify({ planId: PLAN }) });
      setMessage(result.status === 'validated' ?
        `Validation response received${result.warningCount ? ` with ${result.warningCount} warning(s)` : ''}. This does not prove conversion delivery or matching.` :
        'The result is not confirmed. Do not repeat the attempt.');
    } catch { setMessage('The result is unavailable or uncertain. Do not repeat the attempt; ask the reviewer to inspect the safe result.'); }
  }

  return <section aria-labelledby="ads-validation-heading" className="mx-auto max-w-2xl space-y-6 p-6">
    <h1 id="ads-validation-heading" className="text-2xl font-bold text-navy-950">Private measurement validation</h1>
    <p>This temporary check is for the authorised operator only, after the exact release and time window have been approved. It uses a synthetic validation request, not a customer booking.</p>
    <p>Routine reporting stays disabled. No booking, payment or customer notification is created. A successful validation does not mean Google Ads has received a real conversion.</p>
    <p role="status" className="rounded-lg border border-silver-300 bg-white p-4">{message}</p>
    <button type="button" disabled={!ready} onClick={() => void runOnce()}
      className="min-h-11 rounded-lg bg-navy-950 px-5 py-3 font-semibold text-white disabled:opacity-50">
      Run approved validation once
    </button>
  </section>;
}
