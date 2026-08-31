import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, authFetch } from '../lib/authFetch';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import type { BeforeAfter, MediaAsset, MediaCategory, MediaLibrary } from '../types/media';

type FormState = {
  title: string;
  altText: string;
  service: string;
  category: MediaCategory;
  beforeAfter: BeforeAfter;
  pairKey: string;
  locationLabel: string;
  slotKey: string;
  websiteVisible: boolean;
  googleEnabled: boolean;
  socialEnabled: boolean;
};

const initialForm: FormState = {
  title: '', altText: '', service: '', category: 'end-of-tenancy', beforeAfter: 'none', pairKey: '', locationLabel: '',
  slotKey: '', websiteVisible: false, googleEnabled: false, socialEnabled: false,
};

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function videoPoster(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=640&fit_mode=preserve`;
}

export default function MediaManagerPage() {
  const [library, setLibrary] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load({ sync = false } = {}) {
    try {
      setError('');
      const result = await authFetch<MediaLibrary>('/api/media');
      if (sync) {
        const processing = result.assets.filter((asset) => asset.mediaType === 'video' && asset.status === 'processing');
        await Promise.all(processing.map((asset) => authFetch(`/api/media/${asset.id}`, { method: 'POST', body: JSON.stringify({ action: 'sync' }) }).catch(() => null)));
        if (processing.length) {
          const refreshed = await authFetch<MediaLibrary>('/api/media');
          setLibrary(refreshed);
          return;
        }
      }
      setLibrary(result);
    } catch (err) {
      setError(message(err, 'Could not load the media library.'));
    }
  }

  useEffect(() => { void load(); }, []);

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile || uploading) {
      if (!selectedFile) setError('Choose a photo or video first.');
      return;
    }
    if (form.websiteVisible && !form.altText.trim()) {
      setError('Add a clear description before publishing a photo or video to the website.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const plan = await authFetch<{ id: string; uploadUrl: string }>('/api/media', {
        method: 'POST',
        body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type, size: selectedFile.size, ...form }),
      });
      const upload = await fetch(plan.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });
      if (!upload.ok) throw new Error('The private original upload did not finish. Try again.');
      await authFetch(`/api/media/${plan.id}`, { method: 'POST', body: JSON.stringify({ action: 'complete' }) });
      setSelectedFile(null);
      setForm(initialForm);
      if (fileRef.current) fileRef.current.value = '';
      await load({ sync: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : message(err, 'Upload failed. Please try again.'));
      await load();
    } finally {
      setUploading(false);
    }
  }

  function beginEdit(asset: MediaAsset) {
    setEditing(asset);
    setForm({
      title: asset.title, altText: asset.altText, service: asset.service, category: asset.category,
      beforeAfter: asset.beforeAfter, pairKey: asset.pairKey, locationLabel: asset.locationLabel,
      slotKey: asset.activeSlotKey || asset.requestedSlotKey || '', websiteVisible: asset.websiteVisible,
      googleEnabled: asset.googleEnabled, socialEnabled: asset.socialEnabled,
    });
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (form.websiteVisible && !form.altText.trim()) {
      setError('Add a clear description before publishing to the website.');
      return;
    }
    try {
      setError('');
      await authFetch(`/api/media/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      setEditing(null);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(message(err, 'Could not save the media details.'));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Private originals · fast public delivery</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy-950">Media manager</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-700">Upload from your iPhone, choose a gallery slot, and publish only media you have permission to share.</p>
        </div>
        <button type="button" onClick={() => void load({ sync: true })} className="min-h-11 rounded-lg border border-silver-300 bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-silver-100">
          Refresh processing
        </button>
      </div>

      {error && <div className="mb-5"><ErrorState message={error} onRetry={() => void load()} /></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-navy-950">{editing ? 'Edit media details' : 'Add new media'}</h2>
          <p className="mt-1 text-sm text-navy-700">{editing ? 'Changing the slot updates the website without a deployment.' : 'Your original uploads directly to the private R2 vault. Delivery copies are created automatically.'}</p>
          <form className="mt-5 space-y-4" onSubmit={editing ? saveEdit : handleUpload}>
            {!editing && (
              <label className="block">
                <span className={labelClass}>Photo or video *</span>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,video/mp4,video/quicktime,video/webm" capture="environment" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className={inputClass} />
                <span className="mt-1 block text-xs text-navy-700">Photos and MOV/MP4/WebM videos. Keep customer names and house numbers out of the file name.</span>
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title"><input value={form.title} onChange={(e) => patchForm('title', e.target.value)} className={inputClass} placeholder="e.g. Living-room carpet result" /></Field>
              <Field label="Service"><input value={form.service} onChange={(e) => patchForm('service', e.target.value)} className={inputClass} placeholder="e.g. Carpet cleaning" /></Field>
              <Field label="Gallery category"><select value={form.category} onChange={(e) => patchForm('category', e.target.value as MediaCategory)} className={inputClass}><option value="end-of-tenancy">End of tenancy</option><option value="carpet">Carpet</option><option value="sofa-upholstery">Sofa & upholstery</option></select></Field>
              <Field label="Before / after"><select value={form.beforeAfter} onChange={(e) => patchForm('beforeAfter', e.target.value as BeforeAfter)} className={inputClass}><option value="none">Not a comparison</option><option value="before">Before</option><option value="after">After</option></select></Field>
              <Field label="Comparison set (optional)"><input value={form.pairKey} onChange={(e) => patchForm('pairKey', e.target.value)} className={inputClass} placeholder="e.g. job-aug-2026-oven" /></Field>
              <Field label="Area label (optional)"><input value={form.locationLabel} onChange={(e) => patchForm('locationLabel', e.target.value)} className={inputClass} placeholder="Only if approved to name it" /></Field>
            </div>
            <Field label="Description for visitors *"><textarea value={form.altText} onChange={(e) => patchForm('altText', e.target.value)} className={`${inputClass} min-h-24`} placeholder="Describe what is visibly shown, without personal details." /></Field>
            <Field label="Gallery slot (optional)"><select value={form.slotKey} onChange={(e) => patchForm('slotKey', e.target.value)} className={inputClass}><option value="">Keep in library only</option>{(library?.slots || []).map((slot) => <option key={slot.key} value={slot.key}>{slot.label}{slot.assetId ? ' — replaces current media' : ''}</option>)}</select></Field>
            <div className="rounded-xl bg-silver-100 p-3">
              <p className="text-sm font-semibold text-navy-950">Where can this be used?</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Check label="Show on website" checked={form.websiteVisible} onChange={(value) => patchForm('websiteVisible', value)} />
                <Check label="Eligible for Google" checked={form.googleEnabled} onChange={(value) => patchForm('googleEnabled', value)} />
                <Check label="Eligible for social" checked={form.socialEnabled} onChange={(value) => patchForm('socialEnabled', value)} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {editing && <button type="button" onClick={() => { setEditing(null); setForm(initialForm); }} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-semibold text-navy-900">Cancel</button>}
              <button type="submit" disabled={uploading} className="min-h-11 rounded-lg bg-navy-950 px-5 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">
                {uploading ? 'Uploading safely…' : editing ? 'Save details' : 'Upload and prepare'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-navy-950">20 live gallery slots</h2>
          <p className="mt-1 text-sm text-navy-700">A slot stays the same while its media can change. New files get a new delivery ID, so replacements are CDN-safe.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {(library?.slots || Array.from({ length: 20 }, (_, index) => ({ key: `gallery-${String(index + 1).padStart(2, '0')}`, label: `Gallery slot ${String(index + 1).padStart(2, '0')}`, assetId: null }))).map((slot) => {
              const asset = library?.assets.find((item) => item.id === slot.assetId);
              return <div key={slot.key} className={`rounded-lg border p-2 ${asset ? 'border-sky-200 bg-sky-50' : 'border-silver-300 bg-silver-100'}`}><p className="text-xs font-semibold text-navy-950">{slot.key}</p><p className="mt-1 truncate text-xs text-navy-700">{asset?.title || 'Empty'}</p></div>;
            })}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-navy-950">Library</h2><p className="mt-1 text-sm text-navy-700">Originals stay private. The preview is the website delivery copy.</p></div><span className="text-sm text-navy-700">{library?.assets.length || 0} items</span></div>
        {!library ? <p className="mt-6 text-sm text-navy-700">Loading library…</p> : library.assets.length === 0 ? <div className="mt-5"><EmptyState title="No media yet" description="Use the form above to add the first approved photo or video." /></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{library.assets.map((asset) => <MediaCard key={asset.id} asset={asset} onEdit={beginEdit} />)}</div>}
      </section>
    </div>
  );
}

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
const labelClass = 'text-sm font-semibold text-navy-900';

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className={labelClass}>{label}</span>{children}</label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 items-center gap-2 text-sm text-navy-900"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-silver-300 text-sky-600 focus:ring-sky-500" />{label}</label>; }

function MediaCard({ asset, onEdit }: { asset: MediaAsset; onEdit: (asset: MediaAsset) => void }) {
  const preview = asset.imageUrl || (asset.muxPlaybackId ? videoPoster(asset.muxPlaybackId) : null);
  const statusClass = asset.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : asset.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';
  return <article className="overflow-hidden rounded-xl border border-silver-300 bg-white"><div className="aspect-video bg-silver-100">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-navy-700">{asset.mediaType === 'video' ? 'Video processing' : 'Original upload waiting'}</div>}</div><div className="p-3"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 font-semibold text-navy-950">{asset.title || 'Untitled media'}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>{asset.status}</span></div><p className="mt-1 text-xs text-navy-700">{asset.category} · {asset.activeSlotKey || 'library only'}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-navy-700">{asset.websiteVisible ? 'Website enabled' : 'Private'}</span><button type="button" onClick={() => onEdit(asset)} className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-semibold text-navy-900 hover:bg-silver-100">Edit</button></div>{asset.processingError && <p className="mt-2 text-xs text-red-700">{asset.processingError}</p>}</div></article>;
}
