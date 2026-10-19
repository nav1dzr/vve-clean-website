import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';
import { useAuth } from '../auth/useAuth';
import { clearCustomerEmailDraft, readCustomerEmailDraft, saveCustomerEmailDraft, type CustomerEmailDraft } from '../lib/customerEmailDraft';
import { INVOICE_RECOVERY_CLEARED_EVENT } from '../lib/invoiceDraftRecovery';

interface EmailRecord extends CustomerEmailDraft { status: 'draft' | 'sending' | 'accepted' | 'uncertain'; created_at: string; accepted_at: string | null }
interface EmailPreview { email: EmailRecord; html: string; text: string }
interface History { emails: EmailRecord[]; sendingConfigured: boolean }
const fieldClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100';
const buttonClass = 'min-h-11 rounded-lg border border-silver-300 px-4 py-2 text-sm font-semibold text-navy-950 disabled:opacity-50';
const statusLabel = { draft: 'Saved draft', sending: 'Sending status unconfirmed', accepted: 'Accepted by email provider', uncertain: 'Delivery unconfirmed — check Sent mail' };
const blank = (): CustomerEmailDraft => ({ id: crypto.randomUUID(), recipient: '', subject: '', body: '', style: 'simple' });

export default function CustomerEmailPage() {
  const { id } = useParams<{ id: string }>();
  const { admin } = useAuth();
  if (!id || !admin) return null;
  return <Composer key={admin.id + ':' + id} customerId={id} userId={admin.id} />;
}
function Composer({ customerId, userId }: { customerId: string; userId: string }) {
  const [draft, setDraft] = useState(() => readCustomerEmailDraft(userId, customerId) || blank());
  const [customer, setCustomer] = useState<{ name: string; email: string | null } | null>(null);
  const [history, setHistory] = useState<EmailRecord[]>([]);
  const [configured, setConfigured] = useState(false);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [result, setResult] = useState<EmailRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const active = useRef(true);
  const allowedToSave = useRef(true);
  const draftRef = useRef(draft);
  const busyRef = useRef(false);
  draftRef.current = draft;
  const endpoint = '/api/customers/' + customerId + '?action=emails';

  useEffect(() => {
    active.current = true;
    const cleared = () => { allowedToSave.current = false; };
    window.addEventListener(INVOICE_RECOVERY_CLEARED_EVENT, cleared);
    void authFetch<{ name: string; email: string | null }>('/api/customers/' + customerId).then(data => {
      if (!active.current) return;
      setCustomer(data);
      setDraft(value => value.recipient || value.body || value.subject ? value : { ...value, recipient: data.email || '' });
      setLoaded(true);
    }).catch(() => { if (active.current) setError('Could not load this customer. Return to Customers and try again.'); });
    void authFetch<History>(endpoint).then(data => {
      if (!active.current) return;
      setHistory(data.emails); setConfigured(data.sendingConfigured);
      const previous = data.emails.find(row => row.id === draftRef.current.id);
      if (previous && previous.status !== 'draft') {
        setResult(previous);
        if (previous.status === 'accepted') clearCustomerEmailDraft(userId, customerId);
      }
    }).catch(err => { if (active.current) setError(err.message); });
    return () => { active.current = false; window.removeEventListener(INVOICE_RECOVERY_CLEARED_EVENT, cleared); };
  }, [customerId, endpoint, userId]);

  useEffect(() => {
    if (!loaded || !allowedToSave.current || result) return;
    setStorageWarning(!saveCustomerEmailDraft(userId, customerId, draft));
  }, [draft, userId, customerId, loaded, result]);

  function edit(patch: Partial<CustomerEmailDraft>) {
    setDraft(value => ({ ...value, ...patch, id: crypto.randomUUID() }));
    setPreview(null); setConfirm(false); setResult(null); setNotice('');
  }
  async function review() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const current = draftRef.current;
    try {
      const data = await authFetch<EmailPreview>(endpoint, { method: 'POST', body: JSON.stringify({ operation: 'preview', ...current }) });
      if (!active.current || draftRef.current.id !== current.id) return;
      setPreview(data); setConfirm(false);
      setHistory(rows => [data.email, ...rows.filter(row => row.id !== data.email.id)]);
      setNotice('Draft saved. Check the preview and recipient before sending.');
    } catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'Could not prepare this email.'); }
    finally { busyRef.current = false; if (active.current) setBusy(false); }
  }
  async function send() {
    if (!preview || !confirm || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const data = await authFetch<{ email: EmailRecord; warning?: string }>(endpoint, { method: 'POST', body: JSON.stringify({ operation: 'send', id: preview.email.id, confirmedRecipient: preview.email.recipient }) });
      if (!active.current) return;
      setResult(data.email); setHistory(rows => [data.email, ...rows.filter(row => row.id !== data.email.id)]);
      if (data.warning) setNotice(data.warning);
      if (data.email.status === 'accepted') clearCustomerEmailDraft(userId, customerId);
    } catch {
      if (!active.current) return;
      setResult({ ...preview.email, status: 'uncertain' });
      setError('The send result is unclear. Do not send another copy. Check the status below and your Sent mail first.');
    } finally { busyRef.current = false; if (active.current) setBusy(false); }
  }
  async function refreshHistory() {
    setError('');
    try {
      const data = await authFetch<History>(endpoint);
      if (!active.current) return;
      setHistory(data.emails); setConfigured(data.sendingConfigured);
      if (result) {
        const latest = data.emails.find(row => row.id === result.id);
        if (latest) {
          setResult(latest);
          if (latest.status === 'accepted') clearCustomerEmailDraft(userId, customerId);
          if (latest.status === 'draft') { setResult(null); setConfirm(false); setNotice('The server still has an unsent draft. Review the recipient before trying again.'); }
        }
      }
    } catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'Could not check email history.'); }
  }

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
    <Link to={'/customers/' + customerId} className="text-sm font-medium text-sky-700">← Customer details</Link>
    <header className="mb-6 mt-4"><p className="text-sm text-navy-600">{customer?.name || 'Customer email'}</p><h1 className="mt-1 text-2xl font-semibold text-navy-950">Write an email</h1><p className="mt-2 max-w-2xl text-sm text-navy-700">Paste your message, choose a style and check the preview. You decide when it is sent. Replies come to contact@vveclean.co.uk.</p></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-navy-800">{notice}</p>}
    {storageWarning && <p role="status" className="mb-4 text-sm text-amber-800">This browser cannot keep a working copy. Use Save draft & preview before leaving the page.</p>}
    {!configured && loaded && <p className="mb-4 text-sm text-amber-800">Sending is unavailable until email storage and the existing mail connection are ready. You can keep editing.</p>}
    <div className="rounded-2xl border border-silver-200 bg-white p-4 sm:p-6">
      <fieldset disabled={busy || !!result || !loaded} className="space-y-4 disabled:opacity-70">
        <label className="block text-sm font-medium text-navy-900">To<input className={'mt-1 ' + fieldClass} type="email" autoComplete="off" value={draft.recipient} maxLength={254} onChange={event => edit({ recipient: event.target.value })} /></label>
        <label className="block text-sm font-medium text-navy-900">Subject<input className={'mt-1 ' + fieldClass} value={draft.subject} maxLength={180} onChange={event => edit({ subject: event.target.value })} /></label>
        <fieldset><legend className="mb-2 text-sm font-medium text-navy-900">Email style</legend><div className="grid gap-3 sm:grid-cols-2">{(['simple', 'branded'] as const).map(style => <label key={style} className={'cursor-pointer rounded-xl border p-3 ' + (draft.style === style ? 'border-sky-600 bg-sky-50' : 'border-silver-300')}><input type="radio" name="email-style" value={style} checked={draft.style === style} onChange={() => edit({ style })} /> <span className="text-sm font-semibold">{style === 'simple' ? 'Simple signature' : 'Branded letter'}</span><span className="mt-1 block text-sm text-navy-700">{style === 'simple' ? 'A personal email with a neat VVE footer.' : 'VVE logo, soft blue frame and clear sections.'}</span></label>)}</div></fieldset>
        <label className="block text-sm font-medium text-navy-900">Message<textarea className={'mt-1 min-h-80 ' + fieldClass} rows={16} maxLength={20000} value={draft.body} onChange={event => edit({ body: event.target.value })} placeholder="Include your greeting, message and sign-off." /></label>
        <details className="text-sm text-navy-700"><summary className="cursor-pointer py-2 font-medium">Formatting help</summary><p className="mt-2">Normal paragraphs work as they are. Use **bold**, # for a heading, and - for a bullet point. Tables pasted from ChatGPT using | columns | also work. HTML code is shown as text. Your wording and prices are not rewritten automatically.</p></details>
      </fieldset>
      <p className="mt-3 text-xs text-navy-600">Your working copy stays in this browser session for up to 24 hours and is cleared on sign-out. Saved previews remain in this customer's email history.</p>
      {!result && <button type="button" disabled={busy || !loaded || !draft.recipient.trim() || !draft.subject.trim() || !draft.body.trim()} onClick={() => void review()} className="mt-5 min-h-11 rounded-lg bg-navy-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : 'Save draft & preview'}</button>}
    </div>
    {preview && <section aria-label="Email preview" className="mt-6">
      <h2 className="text-lg font-semibold text-navy-950">Customer preview</h2><p className="mt-1 text-sm text-navy-700">To: {preview.email.recipient}<br />Subject: {preview.email.subject}</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-silver-300 bg-white" dangerouslySetInnerHTML={{ __html: preview.html }} />
      {!result && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4"><label className="flex items-start gap-3 text-sm text-navy-900"><input type="checkbox" className="mt-1" checked={confirm} disabled={busy} onChange={event => setConfirm(event.target.checked)} /><span>I have checked the recipient, wording, prices and terms. Send this email to <strong>{preview.email.recipient}</strong>.</span></label><button type="button" disabled={!confirm || busy || !configured} onClick={() => void send()} className="mt-4 min-h-11 rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send email'}</button></div>}
    </section>}
    {result && <section role="status" className="mt-6 rounded-xl border border-silver-300 bg-white p-4"><h2 className="font-semibold text-navy-950">{statusLabel[result.status]}</h2><p className="mt-2 text-sm text-navy-700">{result.status === 'accepted' ? 'The mail provider accepted this message. This does not confirm delivery or that the customer has read it.' : 'Do not send another copy until you have checked the status and Sent mail. We will not automatically retry this message.'}</p><button className={'mt-3 ' + buttonClass} onClick={() => void refreshHistory()}>Check sending status</button>{result.status === 'accepted' && <button className={'ml-2 mt-3 ' + buttonClass} onClick={() => { setDraft({ ...blank(), recipient: customer?.email || '' }); setPreview(null); setResult(null); setConfirm(false); setNotice(''); }}>Write another email</button>}</section>}
    <section className="mt-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-navy-950">Email history</h2><button className={buttonClass} onClick={() => void refreshHistory()}>Refresh history</button></div><p className="mt-1 text-xs text-navy-600">The latest 20 drafts and sending attempts from this composer. Customer replies arrive in your contact inbox.</p>
      <ul className="mt-4 space-y-3">{history.map(row => <li key={row.id} className="rounded-xl border border-silver-200 bg-white p-4"><p className="break-words font-semibold text-navy-950">{row.subject}</p><p className="mt-1 break-words text-sm text-navy-700">{row.recipient} · {statusLabel[row.status]}</p><p className="mt-1 text-xs text-navy-600">{new Date(row.created_at).toLocaleString('en-GB')}</p>{row.status === 'draft' && !result && <button className={'mt-3 ' + buttonClass} disabled={busy} onClick={() => { setDraft({ id: row.id, recipient: row.recipient, subject: row.subject, body: row.body, style: row.style }); setPreview(null); setConfirm(false); setNotice('Draft opened. Save draft & preview before sending.'); }}>Open draft</button>}</li>)}</ul>
      {history.length === 0 && <p className="mt-4 text-sm text-navy-600">No saved emails from this composer yet.</p>}
    </section>
  </div>;
}
