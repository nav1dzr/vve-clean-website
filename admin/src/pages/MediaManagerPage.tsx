import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, authFetch } from '../lib/authFetch';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import type { BeforeAfter, MediaAsset, MediaCategory, MediaLibrary, MediaPlacement, MediaType } from '../types/media';

type FormState = { title: string; altText: string; service: string; category: MediaCategory; placement: MediaPlacement | ''; beforeAfter: BeforeAfter; pairKey: string; locationLabel: string; slotKey: string; websiteVisible: boolean; googleEnabled: boolean; socialEnabled: boolean; };
type Destination = 'main' | 'gallery' | 'carpet' | 'sofa' | 'end-of-tenancy';

const placementDetails: Record<MediaPlacement, { label: string; description: string; service: string; category: MediaCategory }> = {
  'main-home': { label: 'Main website', description: 'Featured media on the home page', service: 'VVE Clean', category: 'end-of-tenancy' },
  'gallery-end-of-tenancy': { label: 'Gallery · End of tenancy', description: 'The End of tenancy part of the Gallery', service: 'End of tenancy cleaning', category: 'end-of-tenancy' },
  'gallery-carpet': { label: 'Gallery · Carpet', description: 'The Carpet part of the Gallery', service: 'Carpet cleaning', category: 'carpet' },
  'gallery-sofa': { label: 'Gallery · Sofa & upholstery', description: 'The Sofa & upholstery part of the Gallery', service: 'Sofa & upholstery cleaning', category: 'sofa-upholstery' },
  'carpet-page': { label: 'Carpet page', description: 'Results shown on the Carpet cleaning page', service: 'Carpet cleaning', category: 'carpet' },
  'sofa-page': { label: 'Sofa & upholstery page', description: 'Results shown on the Sofa cleaning page', service: 'Sofa & upholstery cleaning', category: 'sofa-upholstery' },
  'end-of-tenancy-page': { label: 'End of tenancy page', description: 'Results shown on the End of tenancy page', service: 'End of tenancy cleaning', category: 'end-of-tenancy' },
};
const destinationDetails: Record<Destination, { label: string; description: string }> = {
  main: { label: 'Main website', description: 'Featured VVE Clean media' }, gallery: { label: 'Gallery', description: 'Photos and videos in the public gallery' }, carpet: { label: 'Carpet', description: 'Carpet cleaning results' }, sofa: { label: 'Sofa & upholstery', description: 'Sofa cleaning results' }, 'end-of-tenancy': { label: 'End of tenancy', description: 'End of tenancy results' },
};
const initialForm: FormState = { title: '', altText: '', service: '', category: 'end-of-tenancy', placement: '', beforeAfter: 'none', pairKey: '', locationLabel: '', slotKey: '', websiteVisible: true, googleEnabled: false, socialEnabled: false };

function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
function videoPoster(playbackId: string) { return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=640&fit_mode=preserve`; }
function destinationForPlacement(placement: MediaPlacement): Destination { if (placement === 'main-home') return 'main'; if (placement.startsWith('gallery-')) return 'gallery'; if (placement === 'carpet-page') return 'carpet'; if (placement === 'sofa-page') return 'sofa'; return 'end-of-tenancy'; }

export default function MediaManagerPage() {
  const [library, setLibrary] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [destination, setDestination] = useState<Destination | ''>('');
  const [form, setForm] = useState<FormState>(initialForm);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load({ sync = false } = {}) {
    try {
      setError('');
      const result = await authFetch<MediaLibrary>('/api/search?resource=media');
      if (sync) {
        const processing = result.assets.filter((asset) => asset.mediaType === 'video' && asset.status === 'processing');
        await Promise.all(processing.map((asset) => authFetch(`/api/search?resource=media&id=${encodeURIComponent(asset.id)}`, { method: 'POST', body: JSON.stringify({ action: 'sync' }) }).catch(() => null)));
        if (processing.length) { setLibrary(await authFetch<MediaLibrary>('/api/search?resource=media')); return; }
      }
      setLibrary(result);
    } catch (err) { setError(message(err, 'Could not load the media library.')); }
  }
  useEffect(() => { void load(); }, []);

  const availableSlots = useMemo(() => (library?.slots || []).filter((slot) => slot.placement === form.placement), [library, form.placement]);
  const placementChoices = destination === 'gallery' ? ['gallery-end-of-tenancy', 'gallery-carpet', 'gallery-sofa'] as MediaPlacement[] : destination === 'carpet' ? ['carpet-page', 'gallery-carpet'] as MediaPlacement[] : destination === 'sofa' ? ['sofa-page', 'gallery-sofa'] as MediaPlacement[] : destination === 'end-of-tenancy' ? ['end-of-tenancy-page', 'gallery-end-of-tenancy'] as MediaPlacement[] : [];
  const patchForm = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const choosePlacement = (placement: MediaPlacement) => { const details = placementDetails[placement]; setForm((current) => ({ ...current, placement, slotKey: '', service: details.service, category: details.category, websiteVisible: true })); };
  const chooseDestination = (next: Destination) => { setDestination(next); if (next === 'main') choosePlacement('main-home'); else setForm((current) => ({ ...current, placement: '', slotKey: '' })); };
  const clearForm = () => { setEditing(null); setSelectedFile(null); setMediaType(null); setDestination(''); setForm(initialForm); if (fileRef.current) fileRef.current.value = ''; };

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile || !mediaType) { setError('Start by choosing Photo or Video, then choose the file.'); return; }
    if (!form.placement || !form.slotKey) { setError('Choose where this should appear and an open position.'); return; }
    if (form.websiteVisible && !form.altText.trim()) { setError('Add a short description before publishing to the website.'); return; }
    setUploading(true); setError('');
    try {
      const plan = await authFetch<{ id: string; uploadUrl: string }>('/api/search?resource=media', { method: 'POST', body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type, size: selectedFile.size, ...form }) });
      const upload = await fetch(plan.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
      if (!upload.ok) throw new Error('The private original upload did not finish. Try again.');
      await authFetch(`/api/search?resource=media&id=${encodeURIComponent(plan.id)}`, { method: 'POST', body: JSON.stringify({ action: 'complete' }) });
      clearForm(); await load({ sync: true });
    } catch (err) { setError(err instanceof Error ? err.message : message(err, 'Upload failed. Please try again.')); await load(); } finally { setUploading(false); }
  }
  function beginEdit(asset: MediaAsset) {
    setEditing(asset); setMediaType(asset.mediaType); setDestination(destinationForPlacement(asset.placement));
    setForm({ title: asset.title, altText: asset.altText, service: asset.service, category: asset.category, placement: asset.placement, beforeAfter: asset.beforeAfter, pairKey: asset.pairKey, locationLabel: asset.locationLabel, slotKey: asset.activeSlotKey || asset.requestedSlotKey || '', websiteVisible: asset.websiteVisible, googleEnabled: asset.googleEnabled, socialEnabled: asset.socialEnabled });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !form.placement || !form.slotKey) { setError('Choose the page or gallery area and an open position before saving.'); return; }
    if (form.websiteVisible && !form.altText.trim()) { setError('Add a short description before publishing to the website.'); return; }
    try { setError(''); await authFetch(`/api/search?resource=media&id=${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(form) }); clearForm(); await load(); } catch (err) { setError(message(err, 'Could not save the media details.')); }
  }

  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Private originals · fast public delivery</p><h1 className="mt-1 text-2xl font-semibold text-navy-950">Media manager</h1><p className="mt-1 max-w-2xl text-sm text-navy-700">Upload safely from your iPhone. Pick the page first, then pick its position — no file names or redeployment needed.</p></div><button type="button" onClick={() => void load({ sync: true })} className="min-h-11 rounded-lg border border-silver-300 bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-silver-100">Refresh processing</button></div>
    {error && <div className="mb-5"><ErrorState message={error} onRetry={() => void load()} /></div>}
    <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-navy-950">{editing ? 'Move or edit media' : 'Add media in four quick choices'}</h2><p className="mt-1 text-sm text-navy-700">{editing ? 'Changing its position updates the website once it is ready.' : 'Your original remains private; the website receives an optimised delivery copy.'}</p>
      <form className="mt-5 space-y-7" onSubmit={editing ? saveEdit : handleUpload}>
        {!editing && <div><Step number="1" title="What are you adding?" /><div className="mt-3 grid gap-3 sm:grid-cols-2"><Choice selected={mediaType === 'image'} onClick={() => { setMediaType('image'); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ''; }} title="Photo" description="Before/after photos or finished results" /><Choice selected={mediaType === 'video'} onClick={() => { setMediaType('video'); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ''; }} title="Video" description="MOV, MP4 or WebM — prepared for smooth playback" /></div>{mediaType && <label className="mt-3 block"><span className={labelClass}>Choose {mediaType === 'image' ? 'photo' : 'video'} *</span><input ref={fileRef} type="file" accept={mediaType === 'image' ? 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif' : 'video/mp4,video/quicktime,video/webm'} capture="environment" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className={inputClass} /><span className="mt-1 block text-xs text-navy-700">Keep customer names and house numbers out of the file name.</span></label>}</div>}
        <div><Step number={editing ? '1' : '2'} title="Where should it appear?" /><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{(Object.keys(destinationDetails) as Destination[]).map((key) => <Choice key={key} selected={destination === key} onClick={() => chooseDestination(key)} title={destinationDetails[key].label} description={destinationDetails[key].description} compact />)}</div></div>
        {destination && destination !== 'main' && <div><Step number={editing ? '2' : '3'} title={destination === 'gallery' ? 'Which part of the Gallery?' : `Choose the ${destinationDetails[destination].label} area`} /><p className="mt-1 text-sm text-navy-700">{destination === 'gallery' ? 'Choose the service section to organise the public gallery.' : 'Keep page results and gallery media separate, while using the same simple upload screen.'}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{placementChoices.map((placement) => <Choice key={placement} selected={form.placement === placement} onClick={() => choosePlacement(placement)} title={placementDetails[placement].label} description={placementDetails[placement].description} />)}</div></div>}
        {form.placement && <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5"><Step number={editing ? '3' : '4'} title={`Choose a position in ${placementDetails[form.placement].label}`} /><p className="mt-1 text-sm text-navy-700">Every position is permanent. Replacing it later is safe and does not need a deployment.</p><label className="mt-3 block"><span className={labelClass}>Open position *</span><select value={form.slotKey} onChange={(event) => patchForm('slotKey', event.target.value)} className={inputClass}><option value="">Choose a position</option>{availableSlots.map((slot) => <option key={slot.key} value={slot.key}>{slot.label}{slot.assetId ? ' — replace current media' : ' — empty'}</option>)}</select></label>{library && availableSlots.length === 0 && <p className="mt-2 text-sm text-red-700">This area has not been set up yet. Run the media setup once before using it.</p>}</div>}
        {form.placement && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Title (optional)"><input value={form.title} onChange={(event) => patchForm('title', event.target.value)} className={inputClass} placeholder="e.g. Fresh living-room carpet" /></Field><Field label="Service"><select value={form.service} onChange={(event) => patchForm('service', event.target.value)} className={inputClass}><option>VVE Clean</option><option>Carpet cleaning</option><option>Sofa & upholstery cleaning</option><option>End of tenancy cleaning</option></select></Field></div><Field label="Description for visitors *"><textarea value={form.altText} onChange={(event) => patchForm('altText', event.target.value)} className={`${inputClass} min-h-24`} placeholder="Describe what is visibly shown, without personal details." /></Field><div><p className={labelClass}>Is this part of a before-and-after comparison?</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><Choice selected={form.beforeAfter === 'none'} onClick={() => patchForm('beforeAfter', 'none')} title="Single result" description="A normal photo or video" compact /><Choice selected={form.beforeAfter === 'before'} onClick={() => patchForm('beforeAfter', 'before')} title="Before" description="The starting point" compact /><Choice selected={form.beforeAfter === 'after'} onClick={() => patchForm('beforeAfter', 'after')} title="After" description="The finished result" compact /></div>{form.beforeAfter !== 'none' && <label className="mt-3 block"><span className={labelClass}>Comparison name</span><input value={form.pairKey} onChange={(event) => patchForm('pairKey', event.target.value)} className={inputClass} placeholder="e.g. living-room-carpet" /><span className="mt-1 block text-xs text-navy-700">Use the same short name on its matching before/after media.</span></label>}</div><details className="rounded-xl bg-silver-100 p-3"><summary className="cursor-pointer text-sm font-semibold text-navy-950">More publishing choices</summary><div className="mt-3 grid gap-2 sm:grid-cols-3"><Check label="Show on website" checked={form.websiteVisible} onChange={(value) => patchForm('websiteVisible', value)} /><Check label="Eligible for Google" checked={form.googleEnabled} onChange={(value) => patchForm('googleEnabled', value)} /><Check label="Eligible for social" checked={form.socialEnabled} onChange={(value) => patchForm('socialEnabled', value)} /></div><label className="mt-3 block"><span className={labelClass}>Area label (optional)</span><input value={form.locationLabel} onChange={(event) => patchForm('locationLabel', event.target.value)} className={inputClass} placeholder="Only if you have permission to name it" /></label></details></div>}
        <div className="flex flex-wrap justify-end gap-2">{editing && <button type="button" onClick={clearForm} className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-semibold text-navy-900">Cancel</button>}<button type="submit" disabled={uploading || !form.placement} className="min-h-11 rounded-lg bg-navy-950 px-5 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">{uploading ? 'Uploading safely…' : editing ? 'Save changes' : 'Upload and prepare'}</button></div>
      </form>
    </section>
    <section className="mt-6 rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-navy-950">Media library</h2><p className="mt-1 text-sm text-navy-700">Originals stay private. The preview is the website delivery copy.</p></div><span className="text-sm text-navy-700">{library?.assets.length || 0} items</span></div>{!library ? <p className="mt-6 text-sm text-navy-700">Loading library…</p> : library.assets.length === 0 ? <div className="mt-5"><EmptyState title="No media yet" description="Use the choices above to add the first approved photo or video." /></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{library.assets.map((asset) => <MediaCard key={asset.id} asset={asset} onEdit={beginEdit} />)}</div>}</section>
  </div>;
}

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
const labelClass = 'text-sm font-semibold text-navy-900';
function Step({ number, title }: { number: string; title: string }) { return <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-950 text-xs font-bold text-white">{number}</span><h3 className="font-semibold text-navy-950">{title}</h3></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className={labelClass}>{label}</span>{children}</label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 items-center gap-2 text-sm text-navy-900"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-silver-300 text-sky-600 focus:ring-sky-500" />{label}</label>; }
function Choice({ selected, onClick, title, description, compact = false }: { selected: boolean; onClick: () => void; title: string; description: string; compact?: boolean }) { return <button type="button" onClick={onClick} className={`min-h-16 rounded-xl border p-3 text-left transition ${selected ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600' : 'border-silver-300 bg-white hover:border-sky-300 hover:bg-sky-50/40'} ${compact ? 'min-h-0 py-2' : ''}`}><span className="block text-sm font-semibold text-navy-950">{title}</span><span className="mt-0.5 block text-xs leading-5 text-navy-700">{description}</span></button>; }
function MediaCard({ asset, onEdit }: { asset: MediaAsset; onEdit: (asset: MediaAsset) => void }) { const preview = asset.imageUrl || (asset.muxPlaybackId ? videoPoster(asset.muxPlaybackId) : null); const statusClass = asset.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : asset.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'; return <article className="overflow-hidden rounded-xl border border-silver-300 bg-white"><div className="aspect-video bg-silver-100">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-navy-700">{asset.mediaType === 'video' ? 'Video processing' : 'Original upload waiting'}</div>}</div><div className="p-3"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 font-semibold text-navy-950">{asset.title || 'Untitled media'}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>{asset.status}</span></div><p className="mt-1 text-xs text-navy-700">{placementDetails[asset.placement].label} · {asset.activeSlotKey || 'not placed'}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-navy-700">{asset.websiteVisible ? 'Website enabled' : 'Private'}</span><button type="button" onClick={() => onEdit(asset)} className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-semibold text-navy-900 hover:bg-silver-100">Edit</button></div>{asset.processingError && <p className="mt-2 text-xs text-red-700">{asset.processingError}</p>}</div></article>; }
