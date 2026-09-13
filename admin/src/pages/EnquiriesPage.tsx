import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/authFetch';

type Enquiry = { id: string; full_name: string; email: string; phone: string; service: string; message: string; status: string; notes: string; created_at: string; updated_at: string; delivery: Record<string, { status: string; error?: string }> };
const statuses = ['new', 'contacted', 'qualified', 'closed'];
const field = 'min-h-11 rounded-lg border border-silver-300 bg-white p-3 text-navy-950';
export default function EnquiriesPage() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [filter, setFilter] = useState('new');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkedDestinations, setCheckedDestinations] = useState<Record<string, boolean>>({});
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setBusy(true); setError('');
    try {
      const data = await authFetch<{ enquiries: Enquiry[]; total: number }>(`/api/search?resource=enquiries&status=${filter}&offset=${offset}`);
      if (version === loadVersion.current) { setRows(data.enquiries); setTotal(data.total); }
    } catch (e) { if (version === loadVersion.current) setError(e instanceof Error ? e.message : 'Enquiries could not be loaded.'); }
    finally { if (version === loadVersion.current) setBusy(false); }
  }, [filter, offset]);
  useEffect(() => { void load(); return () => { loadVersion.current += 1; }; }, [load]);
  const act = async (row: Enquiry, action: 'update' | 'retry') => {
    setBusy(true); setError(''); setNotice('');
    try {
      await authFetch('/api/search?resource=enquiries', { method: 'POST', body: JSON.stringify({ id: row.id, action, status: row.status, notes: row.notes || '', expectedUpdatedAt: row.updated_at, confirmRetry: checkedDestinations[row.id] === true }) });
      if (action === 'update') setEditingId(null);
      setCheckedDestinations(values => ({ ...values, [row.id]: false }));
      setNotice(action === 'update' ? 'Enquiry updated.' : 'Delivery checked. See the channel results below.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  };
  const edit = (id: string, patch: Partial<Enquiry>) => { setEditingId(id); setRows(items => items.map(item => item.id === id ? { ...item, ...patch } : item)); };
  return <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
    <h1 className="text-2xl font-semibold text-navy-950">Website enquiries</h1>
    <p className="text-navy-700">Every saved contact form is kept here, including messages whose email notification failed.</p>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="enquiry-filter">Show</label><select id="enquiry-filter" className={field} disabled={busy || !!editingId} value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}><option value="all">All enquiries</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
      <button className={field} disabled={busy || !!editingId} onClick={() => void load()}>Refresh</button>
    </div>
    <p role="alert" className="text-red-700">{error}</p><p role="status" className="text-navy-700">{busy ? 'Working…' : notice}</p>
    {editingId && <p className="text-sm text-navy-700">Save or discard your changes before refreshing, changing view or retrying notifications.</p>}
    {!busy && !rows.length && !error && <p>No enquiries in this view.</p>}
    {rows.map(row => <article key={row.id} className="space-y-4 rounded-xl border border-silver-300 bg-white p-5">
      <div><h2 className="text-lg font-semibold">{row.full_name}</h2><p className="text-sm text-navy-700">{new Date(row.created_at).toLocaleString('en-GB')} · {row.service || 'Service not selected'}</p></div>
      <div className="flex flex-wrap gap-4"><a className="break-all text-sky-700 underline" href={`mailto:${encodeURIComponent(row.email)}`}>{row.email}</a>{row.phone && <a className="text-sky-700 underline" href={`tel:${row.phone.replace(/[^+\d]/g, '')}`}>{row.phone}</a>}</div>
      <p className="whitespace-pre-wrap break-words">{row.message}</p>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="grid gap-1">Status<select className={field} disabled={busy || (!!editingId && editingId !== row.id)} value={row.status} onChange={e => edit(row.id, { status: e.target.value })}>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="grid gap-1">Staff notes<textarea className={field} disabled={busy || (!!editingId && editingId !== row.id)} maxLength={5000} value={row.notes || ''} onChange={e => edit(row.id, { notes: e.target.value })} /></label>
      </div>
      <button className={`${field} font-semibold`} disabled={busy || (!!editingId && editingId !== row.id)} onClick={() => void act(row, 'update')}>Save enquiry</button>
      {editingId === row.id && <button className={`${field} ml-2`} disabled={busy} onClick={() => { setEditingId(null); void load(); }}>Discard unsaved edits</button>}
      <details><summary className="cursor-pointer py-2 font-medium">Notification delivery</summary>
        <ul className="space-y-1 py-2 text-sm">{Object.entries(row.delivery || {}).map(([name, result]) => <li key={name}>{name}: {result.status}{result.error ? ` — ${result.error}` : ''}</li>)}</ul>
        <p className="mb-3 text-sm text-navy-700">A timeout can occur after a message arrives. Check your inbox before retrying. Channels already marked sent are skipped.</p>
        <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={checkedDestinations[row.id] || false} onChange={e => setCheckedDestinations(values => ({ ...values, [row.id]: e.target.checked }))} />I checked the destinations and want to retry missing notifications.</label>
        <button className={field} disabled={busy || !!editingId || !checkedDestinations[row.id]} onClick={() => void act(row, 'retry')}>Retry unconfirmed notifications</button>
      </details>
    </article>)}
    <div className="flex items-center justify-between gap-3"><button className={field} disabled={busy || !!editingId || offset === 0} onClick={() => setOffset(v => Math.max(0, v - 30))}>Previous</button><span>{total ? `${offset + 1}–${Math.min(offset + 30, total)} of ${total}` : '0 enquiries'}</span><button className={field} disabled={busy || !!editingId || offset + 30 >= total} onClick={() => setOffset(v => v + 30)}>Next</button></div>
  </div>;
}
