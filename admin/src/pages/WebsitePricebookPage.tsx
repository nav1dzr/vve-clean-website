import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../lib/authFetch';

type PriceField = { key: string; pence: number };
type Example = { label: string; pence: number };
type PriceVersion = { id: string; label: string; overrides: Record<string, unknown>; created_at: string; published_at: string | null };
type Publication = { id: string; version_id: string; created_at: string; refresh_status: 'pending' | 'requested' | 'failed' };
type PricebookState = {
  current: { id: string; version: string; overrides: Record<string, unknown> };
  versions: PriceVersion[];
  publications: Publication[];
  fields: PriceField[];
  examples: Example[];
  refreshReady: boolean;
};
type Preview = { fields: PriceField[]; examples: Example[]; draft?: PriceVersion };
const ENDPOINT = '/api/search?resource=website-pricebook';
const input = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 focus:border-sky-600';
const button = 'min-h-11 rounded-lg border border-silver-300 bg-white px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-silver-100 disabled:opacity-50';
const primary = `${button} !border-navy-950 !bg-navy-950 !text-white hover:!bg-navy-800`;
const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const groups: Record<string, string> = {
  CARPET_ITEM_PRICES_P: 'Carpet and upholstery items', CARPET_MIN_BOOKING_P: 'Carpet and upholstery minimum',
  EOT_PRICES_P: 'End of tenancy packages', EOT_TAILORED_ADDON_PRICES_P: 'Tailored EOT internal extras',
  EOT_TAILORED_CUPBOARDS_PRICES_P: 'Tailored EOT cupboards', EOT_EXTRA_AREAS_P: 'Additional EOT areas',
  EOT_CARPET_ADDON_PRICES_P: 'Move-in / after-builders carpet bundle rates', MOVEIN_BASE_PRICES_P: 'Move-in cleaning',
  AFTER_BUILDERS_FROM_PRICES_P: 'After builders starting estimates', ADDON_PRICES_P: 'Optional extras',
  WINDOW_QUICK_PRICES_P: 'Window quick estimates', GUTTER_QUICK_PRICES_P: 'Gutter quick estimates',
};
function readable(key: string) {
  return key.replace(/_PRICES_P$|_P$/g, '').replace(/_/g, ' ').replace(/\bbed([1-4])\b/gi, '$1 bedroom').replace(/\bsofa ([23])\b/gi, '$1 seater sofa').toLowerCase();
}
function fieldLabel(key: string) {
  const [group, ...parts] = key.split('.');
  return `${groups[group] || readable(group)}${parts.length ? ` · ${parts.map(readable).join(' · ')}` : ''}`;
}
function fieldsToOverrides(fields: PriceField[], values: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const text = (values[field.key] || '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error(`${fieldLabel(field.key)}: enter pounds with at most two decimal places.`);
    const pence = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(pence) || pence <= 0) throw new Error(`${fieldLabel(field.key)}: enter a positive price.`);
    const parts = field.key.split('.');
    let target = result;
    for (const part of parts.slice(0, -1)) {
      if (!target[part]) target[part] = {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = pence;
  }
  return result;
}

export default function WebsitePricebookPage() {
  const [state, setState] = useState<PricebookState | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<PriceVersion | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const setFields = (fields: PriceField[]) => setValues(Object.fromEntries(fields.map(field => [field.key, (field.pence / 100).toFixed(2)])));
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const data = await authFetch<PricebookState>(ENDPOINT);
      setState(data); setFields(data.fields); setSelected(null); setPreview(null);
      setLabel(`Website prices ${new Date().toLocaleDateString('en-GB')}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load website prices.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changes = useMemo(() => (state?.fields || []).filter(field => Math.round(Number(values[field.key]) * 100) !== field.pence), [state, values]);
  const filtered = useMemo(() => (state?.fields || []).filter(field => fieldLabel(field.key).includes(search.toLowerCase())), [state, search]);
  const grouped = useMemo(() => {
    const result = new Map<string, PriceField[]>();
    for (const field of filtered) {
      const key = field.key.split('.')[0];
      const group = groups[key] || (key.startsWith('COMMERCIAL') ? 'Commercial prices and minimums' : key.startsWith('EOT') ? 'Other end of tenancy prices' : 'Other service prices and minimums');
      result.set(group, [...result.get(group) || [], field]);
    }
    return Array.from(result.entries());
  }, [filtered]);
  async function save(action: 'preview' | 'save-draft') {
    if (!state) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const overrides = fieldsToOverrides(state.fields, values);
      const result = await authFetch<Preview>(ENDPOINT, { method: 'POST', body: JSON.stringify({ action, label, overrides }) });
      setPreview(result);
      if (result.draft) { setSelected(result.draft); setState(previous => previous && ({ ...previous, versions: [result.draft!, ...previous.versions] })); setMessage('Draft saved. Review the changes and example totals before publishing.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not review these prices.'); }
    finally { setBusy(false); }
  }
  async function review(version: PriceVersion) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await authFetch<Preview>(ENDPOINT, { method: 'POST', body: JSON.stringify({ action: 'preview', label: version.label, overrides: version.overrides }) });
      setFields(result.fields); setLabel(version.label); setPreview(result); setSelected(version);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not review this version.'); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!state || !selected || !preview) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await authFetch<{ message: string }>(ENDPOINT, { method: 'POST', body: JSON.stringify({ action: selected.published_at ? 'rollback' : 'publish', versionId: selected.id, expectedVersionId: state.current.id }) });
      await load(); setMessage(result.message);
    } catch (err) { setError(err instanceof Error ? err.message : 'Publication could not be confirmed. Reload before retrying.'); }
    finally { setBusy(false); }
  }
  async function retryRefresh(id: string) {
    setBusy(true); setError('');
    try {
      const result = await authFetch<{ refresh: { status: string } }>(ENDPOINT, { method: 'POST', body: JSON.stringify({ action: 'retry-refresh', publicationId: id }) });
      await load(); setMessage(result.refresh.status === 'requested' ? 'Snapshot refresh requested. Confirm the website build completes.' : 'The snapshot refresh still failed. Check its connection and retry.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not retry refresh.'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-navy-950">Website prices</h1><p className="mt-2 max-w-3xl text-navy-700">One published price list for service pages, calculators and new booking requests. Existing agreed bookings and invoices retain their saved prices.</p></div><button className={button} disabled={busy} onClick={() => void load()}>Reload prices</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-navy-950">{message}</p>}
    {!state ? <p role="status">{busy ? 'Loading website prices…' : 'Reload to try again.'}</p> : <>
      <div className="rounded-xl border border-silver-300 bg-white p-5"><p className="font-semibold text-navy-950">{state.current.id === 'bundled' ? 'Current list: original website prices' : `Current published version: ${state.current.id.slice(0,8)}`}</p><p className="mt-2 text-sm leading-6 text-navy-700">The £30 deposit, coverage, payment policies, guarantee and discount rules are protected. Price changes affect new visits after publication. Search-page snapshots update after the connected website build completes.</p>{!state.refreshReady && <p className="mt-3 text-sm font-semibold text-amber-800">Drafts are available. Publishing needs managed prices enabled and the website snapshot refresh connected.</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="font-semibold text-navy-950">Price list name<input className={`${input} mt-2`} value={label} maxLength={120} onChange={event => { setLabel(event.target.value); setSelected(null); }} /></label><label className="font-semibold text-navy-950">Find a service or item<input className={`${input} mt-2`} value={search} onChange={event => setSearch(event.target.value)} placeholder="For example: sofa, flat, mattress" type="search" /></label></div>
      <div className="space-y-3">{grouped.map(([group, fields]) => <details key={group} className="rounded-xl border border-silver-300 bg-white" open={Boolean(search)}><summary className="cursor-pointer p-4 font-semibold text-navy-950">{group} <span className="font-normal text-navy-700">({fields.length})</span></summary><div className="grid gap-4 border-t border-silver-200 p-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="text-sm font-medium text-navy-950">{fieldLabel(field.key)} <span className="text-navy-600">(£)</span><input className={`${input} mt-1`} type="text" inputMode="decimal" value={values[field.key] || ''} onChange={event => { setValues(previous => ({ ...previous, [field.key]: event.target.value })); setSelected(null); setPreview(null); }} /><span className="mt-1 block text-xs text-navy-700">Published: {money(field.pence)}</span></label>)}</div></details>)}</div>
      <div className="flex flex-wrap items-center gap-3"><button className={button} disabled={busy} onClick={() => void save('preview')}>Preview totals</button><button className={primary} disabled={busy || !label.trim()} onClick={() => void save('save-draft')}>Save draft</button><span className="text-sm text-navy-700">{changes.length} price changes</span></div>
      {preview && <section className="rounded-xl border-2 border-sky-300 bg-white p-5"><h2 className="text-xl font-semibold text-navy-950">Review before publication</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{preview.examples.map(example => <div key={example.label} className="rounded-lg bg-sky-50 p-4"><p className="text-sm text-navy-700">{example.label}</p><p className="mt-2 text-xl font-bold text-navy-950">{money(example.pence)}</p></div>)}</div>{changes.length > 0 && <ul className="mt-5 max-h-64 space-y-2 overflow-y-auto text-sm text-navy-900">{changes.map(field => <li key={field.key}>{fieldLabel(field.key)}: {money(field.pence)} → {money(Math.round(Number(values[field.key]) * 100))}</li>)}</ul>}<p className="mt-4 text-sm text-navy-700">These examples cover standard scope. Minimums, selected extras and photo-assessment rules still apply.</p><button className={`${primary} mt-4`} disabled={busy || !selected || !state.refreshReady} onClick={() => void publish()}>{selected?.published_at ? 'Restore these reviewed prices' : 'Publish this saved price list'}</button>{!selected && <p className="mt-2 text-sm text-navy-700">Save the draft first so this reviewed version can be published.</p>}</section>}
      <section className="rounded-xl border border-silver-300 bg-white p-5"><h2 className="text-xl font-semibold text-navy-950">Saved versions</h2><p className="mt-2 text-sm text-navy-700">Review a saved version before publishing or restoring it. No version changes existing customer records.</p><ul className="mt-4 divide-y divide-silver-200">{state.versions.map(version => <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium text-navy-950">{version.label}{version.id === state.current.id ? ' · Current' : version.published_at ? ' · Previously published' : ' · Draft'}</p><p className="text-xs text-navy-700">{new Date(version.created_at).toLocaleString('en-GB')}</p></div><button className={button} disabled={busy} onClick={() => void review(version)}>Review version</button></li>)}</ul></section>
      {state.publications.some(row => row.refresh_status !== 'requested') && <section className="rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="text-lg font-semibold text-navy-950">Search-page refresh needs attention</h2>{state.publications.filter(row => row.refresh_status !== 'requested').map(row => <div key={row.id} className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm text-navy-900">Publication {new Date(row.created_at).toLocaleString('en-GB')}: {row.refresh_status}</span><button className={button} disabled={busy || !state.refreshReady} onClick={() => void retryRefresh(row.id)}>Retry snapshot refresh</button></div>)}</section>}
    </>}
  </div>;
}
