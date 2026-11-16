import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, UNSAFE_DataRouterContext, useSearchParams } from 'react-router-dom';
import { authFetch, authFetchBlob } from '../lib/authFetch';
import { openPdfBlob } from '../lib/pdf';
import { prepareCompletionPhoto } from '../lib/completionReportPhoto';
import { COMPLETION_REPORT_TEMPLATES, getCompletionReportTemplate } from '../../shared/completionReportTemplates.js';
import type { CompletionEvent, CompletionPayload, CompletionPhoto, CompletionReport, CompletionSend } from '../types/completionReport';
import Modal from '../components/Modal';
import CompletionReportNavigationGuard from '../components/CompletionReportNavigationGuard';
import type { CustomerCard } from '../types/customer';

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 disabled:bg-silver-100';
const buttonClass = 'min-h-11 rounded-lg border border-silver-300 px-4 py-2 text-sm font-semibold disabled:opacity-50';
const primaryClass = `${buttonClass} border-navy-950 bg-navy-950 text-white`;
const emptyPayload = (): CompletionPayload => ({ template: 'carpet', customerName: '', customerEmail: '', propertyAddress: '', serviceDate: '', jobReference: '', summary: '', tasks: [], observations: '', exclusions: '', aftercare: '', internalNotes: '', followUp: '', photos: [] });
const message = (e: unknown) => e instanceof Error ? e.message : 'The action could not be completed. Please try again.';

function TaskDescription({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      if (!ref.current) return;
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);
  return <textarea ref={ref} className={`${inputClass} resize-none overflow-hidden`} rows={3} maxLength={500} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />;
}

function PrivatePhoto({ reportId, photo }: { reportId: string; photo: CompletionPhoto }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    authFetchBlob(`/api/customers?resource=completion-reports&action=photo&id=${encodeURIComponent(reportId)}&photoId=${encodeURIComponent(photo.id)}`)
      .then(blob => { const reader = new FileReader(); reader.onload = () => { if (active) setUrl(String(reader.result)); }; reader.onerror = () => { if (active) setError(true); }; reader.readAsDataURL(blob); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [reportId, photo.id]);
  return <div className="flex h-40 items-center justify-center rounded-lg bg-silver-100">{url ? <img src={url} alt={photo.caption || `${photo.stage} photograph`} className="h-full w-full object-contain" /> : <span className="text-sm text-navy-500">{error ? 'Photograph unavailable' : 'Loading private photograph…'}</span>}</div>;
}

export default function CompletionReportsPage() {
  const [params, setParams] = useSearchParams();
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const allowNavigation = useRef(false);
  function navigateSaved(reportId: string) { allowNavigation.current = true; setParams({ id: reportId }); queueMicrotask(() => { allowNavigation.current = false; }); }
  const id = params.get('id');
  const creating = params.get('new') === '1';
  const bookingId = params.get('bookingId');
  const customerId = params.get('customerId');
  const [reports, setReports] = useState<CompletionReport[]>([]);
  const [listPage, setListPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [report, setReport] = useState<CompletionReport | null>(null);
  const [payload, setPayload] = useState<CompletionPayload>(emptyPayload);
  const [saved, setSaved] = useState('');
  const [links, setLinks] = useState<{ bookingId: string | null; customerId: string | null }>({ bookingId: null, customerId: null });
  const [events, setEvents] = useState<CompletionEvent[]>([]);
  const [sends, setSends] = useState<CompletionSend[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerCard[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<'finalise' | 'send' | 'acknowledge' | 'resolve' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [ackNote, setAckNote] = useState('');
  const [resolveSend, setResolveSend] = useState<CompletionSend | null>(null);
  const [resolveOutcome, setResolveOutcome] = useState<'accepted' | 'not_sent'>('accepted');
  const createId = useRef(crypto.randomUUID());
  const sendOperation = useRef<string | null>(null);
  const editor = Boolean(id || creating);
  const final = report?.status === 'final';
  const dirty = editor && !loading && !final && JSON.stringify(payload) !== saved;
  const guarded = dirty || busy;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setReport(null); setEvents([]); setSends([]); setDialog(null); setHistoryPage(1); setHistoryHasMore(false);
    createId.current = crypto.randomUUID(); sendOperation.current = null;
    const query = new URLSearchParams();
    if (id) query.set('id', id);
    else if (creating) {
      query.set('action', 'defaults');
      if (bookingId) query.set('bookingId', bookingId);
      if (customerId) query.set('customerId', customerId);
    } else { query.set('page', String(listPage)); if (bookingId) query.set('bookingId', bookingId); if (customerId) query.set('customerId', customerId); }
    authFetch<{ report?: CompletionReport; reports?: CompletionReport[]; hasMore?: boolean; payload?: Partial<CompletionPayload>; bookingId?: string; customerId?: string; events?: CompletionEvent[]; sends?: CompletionSend[]; historyHasMore?: boolean }>(`/api/customers?resource=completion-reports&${query}`)
      .then(data => {
        if (!active) return;
        if (data.report) {
          setReport(data.report); setPayload(data.report.payload); setSaved(JSON.stringify(data.report.payload));
          setLinks({ bookingId: data.report.booking_id, customerId: data.report.customer_id });
          setEvents(data.events || []); setSends(data.sends || []); setHistoryHasMore(Boolean(data.historyHasMore));
        } else if (creating) {
          const initial = { ...emptyPayload(), ...data.payload };
          // Suggested tasks always begin unchecked, including booking imports.
          initial.tasks = initial.tasks.map(task => ({ ...task, completed: false }));
          setPayload(initial); setSaved(JSON.stringify(initial));
          setLinks({ bookingId: data.bookingId || bookingId, customerId: data.customerId || customerId });
        } else { setReports(data.reports || []); setHasMore(Boolean(data.hasMore)); }
      }).catch(e => { if (active) setError(message(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, creating, bookingId, customerId, reload, listPage]);

  useEffect(() => {
    if (!guarded) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const link = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('a[href]')) return;
      if (busy || !window.confirm('Leave this report? Unsaved changes will be lost.')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', before);
    if (!dataRouter) document.addEventListener('click', link, true);
    return () => { window.removeEventListener('beforeunload', before); document.removeEventListener('click', link, true); };
  }, [guarded, busy, dataRouter]);

  function update<K extends keyof CompletionPayload>(key: K, value: CompletionPayload[K]) { setPayload(p => ({ ...p, [key]: value })); setNotice(''); }
  async function post<T>(action: string, data: object = {}): Promise<T> {
    return authFetch<T>('/api/customers?resource=completion-reports', { method: 'POST', body: JSON.stringify({ action, ...data }) });
  }
  async function saveDraft(): Promise<CompletionReport> {
    const data = report
      ? await post<{ report: CompletionReport }>('save', { id: report.id, revision: report.revision, payload })
      : await post<{ report: CompletionReport }>('create', { id: createId.current, ...links, payload });
    setReport(data.report); setPayload(data.report.payload); setSaved(JSON.stringify(data.report.payload));
    return data.report;
  }
  async function perform(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(message(e)); } finally { busyRef.current = false; setBusy(false); }
  }
  function openDialog(next: 'finalise' | 'send' | 'acknowledge') {
    setConfirmed(false); setRecipient(payload.customerEmail); setAckNote(''); setDialog(next);
  }
  function reloadSaved(record: CompletionReport) {
    setReport(record); setPayload(record.payload); setSaved(JSON.stringify(record.payload));
    navigateSaved(record.id);
    if (record.id === id) setReload(n => n + 1);
  }
  async function preview(download = false) {
    const record = final && report ? report : await saveDraft();
    const blob = await authFetchBlob(`/api/customers?resource=completion-reports&action=pdf&id=${encodeURIComponent(record.id)}`);
    if (download) {
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `VVE-cleaning-report-${record.id.slice(0, 8)}.pdf`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else openPdfBlob(blob);
    setNotice(final ? 'Final PDF opened. If no window appeared, use Download PDF.' : 'Draft saved and PDF opened. If no window appeared, use Download PDF.');
  }
  function templateChange(template: string) {
    const suggestion = getCompletionReportTemplate(template);
    if (!suggestion) return;
    if (payload.tasks.length && !window.confirm('Replace the checklist and suggested aftercare/exclusions? Existing task selections will be cleared.')) return;
    setPayload(p => ({ ...p, template, tasks: suggestion.tasks.map(text => ({ id: crypto.randomUUID(), text, completed: false })), aftercare: suggestion.aftercare, exclusions: suggestion.exclusions }));
    setNotice('Suggestions added. Tick only the work actually completed and edit the wording for this job.');
  }
  async function upload(file: File) {
    if (payload.photos.length >= 12) throw new Error('A report can contain up to 12 photographs.');
    const prepared = await prepareCompletionPhoto(file);
    const record = await saveDraft();
    const result = await post<{ photo: CompletionPhoto; report: CompletionReport }>('upload', { id: record.id, revision: record.revision, ...prepared });
    setReport(result.report);
    const updatedPayload = { ...record.payload, photos: [...record.payload.photos, result.photo] };
    setPayload(updatedPayload);
    const updated = await post<{ report: CompletionReport }>('save', { id: record.id, revision: result.report.revision, payload: updatedPayload });
    setReport(updated.report); setPayload(updated.report.payload); setSaved(JSON.stringify(updated.report.payload));
    setNotice('Original photograph uploaded privately and included in the saved draft. Add its caption and comparison label.');
  }
  function changePhoto(index: number, change: Partial<CompletionPhoto>) { update('photos', payload.photos.map((photo, i) => i === index ? { ...photo, ...change } : photo)); }
  function movePhoto(index: number, direction: number) { const photos = [...payload.photos]; [photos[index], photos[index + direction]] = [photos[index + direction], photos[index]]; update('photos', photos); }
  const field = (key: 'customerName' | 'customerEmail' | 'propertyAddress' | 'serviceDate' | 'jobReference' | 'summary' | 'observations' | 'exclusions' | 'aftercare' | 'internalNotes' | 'followUp', label: string, multiline = false) => <label className="block text-sm font-medium">{label}{multiline ? <textarea className={inputClass} rows={key === 'propertyAddress' ? 3 : 4} disabled={final || busy} value={payload[key]} onChange={e => update(key, e.target.value)} /> : <input className={inputClass} type={key === 'serviceDate' ? 'date' : key === 'customerEmail' ? 'email' : 'text'} disabled={final || busy} value={payload[key]} onChange={e => update(key, e.target.value)} />}</label>;

  return <main className="mx-auto max-w-5xl space-y-5 pb-12">
    <CompletionReportNavigationGuard dirty={dirty} busy={busy} allowNavigation={allowNavigation} />
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-sky-700">VVE Clean · Job records</p><h1 className="text-2xl font-semibold text-navy-950">{editor ? final ? 'Final cleaning report' : report ? 'Edit cleaning report' : 'Create a cleaning report' : 'Cleaning completion reports'}</h1><p className="mt-2 max-w-2xl text-sm text-navy-600">A record of the work carried out, with your observations and photographs. Separate from invoices and receipts.</p></div>
      <Link className={buttonClass} to={editor ? '/completion-reports' : '/completion-reports?new=1'}>{editor ? 'All reports' : 'Create report'}</Link>
    </header>
    {loading && <p role="status">Loading reports…</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<p className="mt-2">Your last saved draft remains available. Reload only after copying any unsaved changes.</p><button type="button" className="mt-2 min-h-11 underline" disabled={busy} onClick={() => { if (!dirty || window.confirm('Reload the saved draft and discard unsaved changes?')) setReload(n => n + 1); }}>Reload saved data</button></div>}
    {notice && <p role="status" className="rounded-xl bg-sky-50 p-4 text-sm text-navy-800">{notice}</p>}
    {!loading && !editor && <section className="rounded-xl border border-silver-300 bg-white p-4">{reports.length ? <ul className="divide-y divide-silver-200">{reports.map(r => <li key={r.id}><Link className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 text-sm" to={`/completion-reports?id=${r.id}`}><span className="font-semibold text-navy-950">{r.payload.customerName || 'Unnamed customer'}<span className="mt-1 block font-normal text-navy-600">{r.payload.jobReference || 'No job reference'} · {r.payload.serviceDate || 'Date not set'}</span></span><span className="rounded-full bg-silver-100 px-3 py-1 capitalize">{r.status}</span></Link></li>)}</ul> : !error && <p className="text-sm text-navy-600">No reports yet. Start from a booking or create a report for a manual job.</p>}</section>}
    {!loading && !editor && !error && <nav aria-label="Report pages" className="flex items-center gap-3"><button className={buttonClass} disabled={listPage === 1} onClick={() => setListPage(n => n - 1)}>Previous reports</button><span className="text-sm">Page {listPage}</span><button className={buttonClass} disabled={!hasMore} onClick={() => setListPage(n => n + 1)}>Older reports</button></nav>}
    {!loading && editor && <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-navy-950 p-4 text-sm text-white"><strong>{final ? 'Final report · locked' : dirty ? 'Unsaved changes' : report ? 'Draft saved' : 'New report · not saved'}</strong>{report && <span className="break-all text-sky-100">Report {report.id.slice(0, 8).toUpperCase()}</span>}{links.bookingId && <Link className="underline" to={`/bookings/${links.bookingId}`}>Linked booking</Link>}{links.customerId && <Link className="underline" to={`/customers/${links.customerId}`}>Customer</Link>}</div>
      {final && <p className="rounded-xl border border-silver-300 bg-white p-4 text-sm text-navy-700">This PDF is a fixed record. To prepare another report, duplicate it and review all work again. Finalising does not change the booking, invoice or payment status.</p>}
      <section className="space-y-4 rounded-xl border border-silver-300 bg-white p-5"><h2 className="font-semibold">Customer and job</h2>{!report && <details className="rounded-lg bg-silver-100 p-3"><summary className="cursor-pointer text-sm font-semibold">Link an existing customer record (optional)</summary><p className="my-2 text-sm">Choose the correct customer to include this report in their history. The property address stays separate.</p>{links.customerId && <p className="text-sm">Linked: {selectedCustomer || 'existing customer'} <button className="min-h-11 underline" disabled={busy} onClick={() => { setLinks(p => ({ ...p, customerId: null })); setSelectedCustomer(''); }}>Remove link</button></p>}<label className="block text-sm">Search customers<input className={inputClass} value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} /></label><button className={`${buttonClass} mt-2`} disabled={busy || customerSearch.trim().length < 2} onClick={() => void perform(async () => { const data = await authFetch<{ results: CustomerCard[] }>(`/api/customers?q=${encodeURIComponent(customerSearch.trim())}&pageSize=20`); setCustomerResults(data.results); if (!data.results.length) setNotice('No matching customer found. You can still create a manual report.'); })}>Find customer</button><ul className="mt-2 space-y-2">{customerResults.map(customer => <li key={customer.id}><button disabled={busy} className="min-h-11 w-full rounded-lg border border-silver-300 bg-white p-3 text-left text-sm" onClick={() => { setLinks(p => ({ ...p, customerId: customer.id })); setSelectedCustomer(customer.name); setPayload(p => ({ ...p, customerName: customer.name, customerEmail: customer.email || '' })); setCustomerResults([]); }}>Use {customer.name} · {customer.email || customer.postcode || 'No email'}</button></li>)}</ul></details>}<div className="grid gap-4 sm:grid-cols-2">{field('customerName', 'Customer / company name')}{field('customerEmail', 'Email for this report (optional until sending)')}{field('serviceDate', 'Actual service date')}{field('jobReference', 'Job reference (optional)')}</div>{field('propertyAddress', 'Property cleaned', true)}</section>
      <section className="space-y-4 rounded-xl border border-silver-300 bg-white p-5"><h2 className="font-semibold">Work actually completed</h2><p className="text-sm text-navy-600">Templates suggest tasks. Nothing is marked completed automatically. Unticked tasks are not presented as completed in the PDF; describe unfinished work under exceptions.</p><label className="block text-sm font-medium">Starting template<select disabled={final || busy} className={inputClass} value={payload.template} onChange={e => templateChange(e.target.value)}>{COMPLETION_REPORT_TEMPLATES.map(t => <option value={t.id} key={t.id}>{t.label}</option>)}</select></label>{!final && <button type="button" disabled={busy} className={buttonClass} onClick={() => templateChange(payload.template)}>Use suggested checklist</button>}{field('summary', 'Completed-service summary', true)}
        <ul className="space-y-3">{payload.tasks.map((task, index) => <li key={task.id} className="flex items-start gap-3 rounded-lg bg-silver-100 p-3"><input aria-label={`Completed: ${task.text || `task ${index + 1}`}`} type="checkbox" className="mt-3 h-5 w-5 shrink-0" checked={task.completed} disabled={final || busy} onChange={e => update('tasks', payload.tasks.map((t, i) => i === index ? { ...t, completed: e.target.checked } : t))} /><label className="min-w-0 flex-1 text-xs text-navy-600">Task {index + 1}<TaskDescription value={task.text} disabled={final || busy} onChange={text => update('tasks', payload.tasks.map((t, i) => i === index ? { ...t, text } : t))} /></label>{!final && <button disabled={busy} className="min-h-11 px-1 text-sm underline" aria-label={`Remove task ${index + 1}`} onClick={() => update('tasks', payload.tasks.filter((_, i) => i !== index))}>Remove</button>}</li>)}</ul>{!final && <button disabled={busy || payload.tasks.length >= 60} className={buttonClass} onClick={() => update('tasks', [...payload.tasks, { id: crypto.randomUUID(), text: '', completed: false }])}>Add task</button>}
      </section>
      <details className="rounded-xl border border-silver-300 bg-white p-5" open><summary className="cursor-pointer font-semibold">Observations, exceptions and aftercare</summary><div className="mt-4 space-y-4">{field('observations', 'Cleaning observations / remaining stains', true)}{field('exclusions', 'Outstanding issues, exclusions or unfinished work', true)}{field('aftercare', 'Aftercare advice', true)}{field('followUp', 'Optional follow-up recommendations', true)}</div></details>
      <section className="space-y-4 rounded-xl border border-silver-300 bg-white p-5"><h2 className="font-semibold">Photographs <span className="font-normal text-navy-500">({payload.photos.length}/12)</span></h2><p className="text-sm text-navy-600">Original JPEG/PNG files are kept privately and unchanged. A resized copy is used in the PDF. Up to 2 MB per original. Add the same comparison label to one before and one after image; leave it blank for a single photograph.</p>
        {!final && <label className="block text-sm font-medium">Add a private photograph<input type="file" accept="image/jpeg,image/png" className="mt-2 block max-w-full text-sm" disabled={busy || payload.photos.length >= 12} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void perform(() => upload(file)); }} /></label>}
        <div className="grid gap-4 sm:grid-cols-2">{payload.photos.map((photo, index) => <article key={photo.id} className="space-y-3 rounded-xl border border-silver-300 p-3">{report && <><PrivatePhoto reportId={report.id} photo={photo} /><button className={buttonClass} disabled={busy} onClick={() => void perform(async () => { const blob = await authFetchBlob(`/api/customers?resource=completion-reports&action=photo&id=${report.id}&photoId=${photo.id}&original=true`); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `original-${photo.id}.${blob.type.includes('png') ? 'png' : 'jpg'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); })}>Download original</button></>}<label className="block text-sm">Photograph {index + 1} label<input disabled={final || busy} className={inputClass} value={photo.caption} onChange={e => changePhoto(index, { caption: e.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Stage<select disabled={final || busy} className={inputClass} value={photo.stage} onChange={e => changePhoto(index, { stage: e.target.value as CompletionPhoto['stage'] })}><option value="before">Before</option><option value="after">After</option><option value="area">Area / observation</option></select></label><label className="block text-sm">Comparison label<input disabled={final || busy} className={inputClass} value={photo.pairId} placeholder="e.g. Kitchen floor" onChange={e => changePhoto(index, { pairId: e.target.value })} /></label></div>{!final && <div className="flex flex-wrap gap-2"><button disabled={busy || index === 0} className={buttonClass} aria-label={`Move photo ${index + 1} up`} onClick={() => movePhoto(index, -1)}>Earlier</button><button disabled={busy || index === payload.photos.length - 1} className={buttonClass} aria-label={`Move photo ${index + 1} down`} onClick={() => movePhoto(index, 1)}>Later</button><button disabled={busy} className={buttonClass} onClick={() => update('photos', payload.photos.filter((_, i) => i !== index))}>Remove from report</button></div>}</article>)}</div>
        {!payload.photos.length && <p className="rounded-lg bg-silver-100 p-4 text-sm text-navy-600">Photos are optional. The report will still have a complete, neatly laid-out text version.</p>}
      </section>
      <details className="rounded-xl border border-dashed border-silver-300 bg-silver-100 p-5"><summary className="cursor-pointer font-semibold">Internal notes · never included in the customer PDF or email</summary><div className="mt-4">{field('internalNotes', 'Staff-only notes', true)}</div></details>
      <div className="flex flex-wrap gap-3 rounded-xl border border-silver-300 bg-white p-4">{!final && <button className={primaryClass} disabled={busy} onClick={() => void perform(async () => { const r = await saveDraft(); setNotice('Draft saved.'); if (!id) navigateSaved(r.id); })}>{busy ? 'Working…' : 'Save draft'}</button>}<button className={buttonClass} disabled={busy} onClick={() => void perform(() => preview())}>Preview PDF</button><button className={buttonClass} disabled={busy} onClick={() => void perform(() => preview(true))}>Download PDF</button>{!final ? <button className={buttonClass} disabled={busy} onClick={() => openDialog('finalise')}>Finalise report</button> : <><button className={primaryClass} disabled={busy} onClick={() => openDialog('send')}>Review and send email</button><button className={buttonClass} disabled={busy} onClick={() => openDialog('acknowledge')}>Record customer acknowledgement</button></>}{report && <button className={buttonClass} disabled={busy || dirty} onClick={() => void perform(async () => { const result = await post<{ report: CompletionReport }>('duplicate', { id: report.id, newId: crypto.randomUUID() }); reloadSaved(result.report); setNotice('New draft created. Review all copied text and set the actual service date. Tick only the work completed on this job; photographs are not copied.'); })}>Duplicate as new draft</button>}</div>
      {(events.length > 0 || sends.length > 0) && <section className="rounded-xl border border-silver-300 bg-white p-5"><h2 className="mb-3 font-semibold">Report history</h2><ul className="space-y-2 text-sm">{events.map(event => <li key={event.id}>{event.event_type.replace(/_/g, ' ')} · {new Date(event.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</li>)}{sends.map(send => <li key={send.id} className="break-words">Email to {send.recipient} · {send.status} · {new Date(send.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}{['sending', 'uncertain'].includes(send.status) && <button className={`${buttonClass} ml-2`} disabled={busy} onClick={() => { setResolveSend(send); setResolveOutcome('accepted'); setAckNote(''); setConfirmed(false); setDialog('resolve'); }}>Review uncertain delivery</button>}</li>)}</ul>{historyHasMore && <button className={`${buttonClass} mt-3`} disabled={busy} onClick={() => void perform(async () => { if (!report) return; const data = await authFetch<{ events: CompletionEvent[]; sends: CompletionSend[]; historyHasMore: boolean }>(`/api/customers?resource=completion-reports&id=${report.id}&historyPage=${historyPage + 1}`); setEvents(previous => [...previous, ...data.events.filter(event => !previous.some(item => item.id === event.id))]); setSends(previous => [...previous, ...data.sends.filter(send => !previous.some(item => item.id === send.id))]); setHistoryPage(p => p + 1); setHistoryHasMore(data.historyHasMore); })}>Load earlier history</button>}<p className="mt-3 text-xs text-navy-600">Sending records provider acceptance, not proof the customer read or approved the report.</p></section>}
    </>}
    {dialog && <Modal titleId="report-confirm-title" title={dialog === 'finalise' ? 'Approve this report' : dialog === 'send' ? 'Review the customer email' : dialog === 'resolve' ? 'Review uncertain delivery' : 'Record acknowledgement'} onClose={() => { if (!busy) setDialog(null); }}>
      {dialog === 'finalise' && <><p className="text-sm leading-6">The saved PDF becomes a fixed record. Check the actual date, completed work, exceptions and photographs first. This does not send an email or change any financial document.</p><label className="my-4 flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed the report and confirm it accurately records the work carried out.</label><button className={primaryClass} disabled={busy || !confirmed} onClick={() => void perform(async () => { const savedReport = await saveDraft(); const result = await post<{ report: CompletionReport }>('finalise', { id: savedReport.id, revision: savedReport.revision, confirmed: true }); setDialog(null); reloadSaved(result.report); setNotice('Report finalised. No email has been sent.'); })}>Approve and generate final PDF</button></>}
      {dialog === 'send' && <><label className="block text-sm font-medium">Recipient email<input type="email" className={inputClass} value={recipient} disabled={busy || sendOperation.current !== null} onChange={e => setRecipient(e.target.value)} /></label><div className="my-4 rounded-lg bg-silver-100 p-4 text-sm leading-6"><strong>Your cleaning completion report</strong><p>Please find your cleaning completion report attached. It records the work completed, observations and any exclusions. If you have any questions, please reply to this email.</p><p className="mt-2">Thank you,<br />VVE Clean</p><p className="mt-2">Attachment: your final report PDF. Internal notes are excluded.</p></div>{sends.length > 0 && <p className="mb-3 text-sm text-amber-800">This report has previous sending activity. Review the history before deliberately sending another copy.</p>}<label className="my-4 flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked the recipient and final PDF and approve this {sends.length ? 'send / resend' : 'email'}.</label><button className={primaryClass} disabled={busy || !confirmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())} onClick={() => void perform(async () => { if (!report) return; if (!sendOperation.current) sendOperation.current = crypto.randomUUID(); const result = await post<{ send: CompletionSend; duplicatePrevented?: boolean }>('send', { id: report.id, operationId: sendOperation.current, recipient: recipient.trim(), confirmed: true, resendConfirmed: sends.length > 0 }); setSends(list => [...list.filter(s => s.id !== result.send.id), result.send]); setNotice(`Email status: ${result.send.status}. Check the history before sending another copy.`); setDialog(null); setReload(n => n + 1); })}>{sendOperation.current ? 'Check previous send attempt' : sends.length ? 'Send another copy' : 'Send approved email'}</button><p className="mt-3 text-xs leading-5 text-navy-600">If delivery is uncertain, check the existing attempt. Do not start another send until its outcome is known.</p></>}
      {dialog === 'acknowledge' && <><p className="text-sm leading-6">Record that the customer told you they received the report. This is not acceptance of the work or approval by an agency.</p><label className="my-4 block text-sm">How did they acknowledge receipt?<textarea className={inputClass} rows={3} value={ackNote} onChange={e => setAckNote(e.target.value)} /></label><label className="my-4 flex items-start gap-3 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />The customer explicitly acknowledged receiving this report.</label><button className={primaryClass} disabled={busy || !confirmed || !ackNote.trim()} onClick={() => void perform(async () => { if (!report) return; await post('acknowledge', { id: report.id, revision: report.revision, acknowledged: true, note: ackNote }); setDialog(null); setReload(n => n + 1); setNotice('Customer acknowledgement recorded.'); })}>Save acknowledgement</button></>}
      {dialog === 'resolve' && resolveSend && <><p className="text-sm leading-6">Check the business Sent mailbox or email provider records for the exact recipient and report. A timeout alone does not mean an email failed. This action records your investigation; it sends nothing.</p><p className="my-3 break-words text-sm font-semibold">{resolveSend.recipient}</p><label className="block text-sm">Verified outcome<select className={inputClass} value={resolveOutcome} onChange={e => setResolveOutcome(e.target.value as 'accepted' | 'not_sent')}><option value="accepted">Email service accepted the message</option><option value="not_sent">Verified that the message was not sent</option></select></label><label className="mt-3 block text-sm">Evidence checked<textarea className={inputClass} rows={3} value={ackNote} onChange={e => setAckNote(e.target.value)} /></label><label className="my-4 flex items-start gap-3 text-sm"><input className="h-5 w-5 shrink-0" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I investigated this specific attempt and verified the outcome above.</label><button className={primaryClass} disabled={busy || !confirmed || ackNote.trim().length < 10} onClick={() => void perform(async () => { if (!report) return; await post('resolve_send', { id: report.id, operationId: resolveSend.id, outcome: resolveOutcome, note: ackNote, confirmed: true }); setDialog(null); setReload(n => n + 1); setNotice('Delivery investigation saved. No email was sent.'); })}>Record verified outcome</button></>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {busy && <p role="status" className="mt-4 text-sm">Working… Please keep this page open.</p>}
    </Modal>}
  </main>;
}
