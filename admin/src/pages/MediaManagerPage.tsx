import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, authFetch } from '../lib/authFetch';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import type { GallerySlot, MediaAsset, MediaLibrary, MediaUsage, WebsiteSlot } from '../types/media';

type Tab = 'gallery' | 'website' | 'uploads';
type Target = { type: 'gallery' | 'website'; id: string; label: string; role: 'before' | 'after' | 'primary' };
type AssignmentPreview = { asset: MediaAsset; target: Target; replacement: boolean; impact: MediaUsage[] };

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
const buttonClass = 'min-h-11 rounded-lg border border-silver-300 bg-white px-3 text-sm font-semibold text-navy-900 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400';
function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
function videoPoster(playbackId: string) { return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=640&fit_mode=preserve`; }
function assetFor(assignments: { assetId: string; role: string }[], role: string, assets: Map<string, MediaAsset>) { const id = assignments.find((assignment) => assignment.role === role)?.assetId; return id ? assets.get(id) : undefined; }
function isCompatible(asset: MediaAsset, slot?: GallerySlot) { if (!slot) return true; return slot.kind === 'video' ? asset.mediaType === 'video' : asset.mediaType === 'image'; }

export default function MediaManagerPage() {
  const [library, setLibrary] = useState<MediaLibrary | null>(null);
  const [tab, setTab] = useState<Tab>('gallery');
  const [topic, setTopic] = useState('carpet');
  const [error, setError] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreview | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
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
      if (!result.topics.some((item) => item.key === topic) && result.topics[0]) setTopic(result.topics[0].key);
    } catch (err) { setError(message(err, 'Could not load the media manager.')); }
  }
  // The manager loads once after RequireAuth has established the session.
  // `load` is intentionally not a dependency because it is recreated on each
  // render and adding it would turn this into a request loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const assetsById = useMemo(() => new Map((library?.assets || []).map((asset) => [asset.id, asset])), [library]);
  const unassigned = useMemo(() => (library?.assets || []).filter((asset) => asset.usages.length === 0), [library]);
  const topicSlots = useMemo(() => (library?.gallerySlots || []).filter((slot) => slot.topicKey === topic), [library, topic]);
  const websiteGroups = useMemo(() => {
    const groups = new Map<string, WebsiteSlot[]>();
    for (const slot of library?.websiteSlots || []) groups.set(slot.pageLabel, [...(groups.get(slot.pageLabel) || []), slot]);
    return [...groups.entries()];
  }, [library]);

  async function uploadFiles(event: React.FormEvent) {
    event.preventDefault();
    if (!files.length) { setError('Choose one or more photos or videos first.'); return; }
    setUploading(true); setError(''); setUploadNote('Uploading to your private library…');
    try {
      for (const file of files) {
        const plan = await authFetch<{ id: string; uploadUrl: string }>('/api/search?resource=media', { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, websiteVisible: false }) });
        const upload = await fetch(plan.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!upload.ok) throw new Error(`Private upload did not finish for ${file.name}.`);
        await authFetch(`/api/search?resource=media&id=${encodeURIComponent(plan.id)}`, { method: 'POST', body: JSON.stringify({ action: 'complete' }) });
      }
      setFiles([]); if (fileRef.current) fileRef.current.value = '';
      setUploadNote('Upload complete. Nothing has changed on the website — choose a position when you are ready.');
      await load({ sync: true });
    } catch (err) { setError(err instanceof Error ? err.message : message(err, 'Upload failed. Please try again.')); await load(); } finally { setUploading(false); }
  }

  async function reviewAssignment(asset: MediaAsset) {
    if (!target) return;
    setAssigning(true); setError('');
    try {
      const result = await authFetch<{ replacement: boolean; impact: MediaUsage[] }>(`/api/search?resource=media&id=${encodeURIComponent(asset.id)}`, { method: 'POST', body: JSON.stringify({ action: 'assign', targetType: target.type, targetId: target.id, role: target.role, preview: true }) });
      setAssignmentPreview({ asset, target, replacement: result.replacement, impact: result.impact });
    } catch (err) { setError(message(err, 'Could not check where this media is used.')); } finally { setAssigning(false); }
  }
  async function confirmAssignment() {
    if (!assignmentPreview) return;
    setAssigning(true); setError('');
    try {
      await authFetch(`/api/search?resource=media&id=${encodeURIComponent(assignmentPreview.asset.id)}`, { method: 'POST', body: JSON.stringify({ action: 'assign', targetType: assignmentPreview.target.type, targetId: assignmentPreview.target.id, role: assignmentPreview.target.role, confirm: true }) });
      setAssignmentPreview(null); setTarget(null); setUploadNote('Position updated. Every page that references it will use the new media without a redeploy.'); await load();
    } catch (err) { setError(message(err, 'Could not update that position.')); } finally { setAssigning(false); }
  }
  const openTarget = (next: Target) => { setTarget(next); setAssignmentPreview(null); setTab('uploads'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Private originals · controlled delivery · no redeploys</p><h1 className="mt-1 text-2xl font-semibold text-navy-950">Media manager</h1><p className="mt-1 max-w-3xl text-sm text-navy-700">Upload first, then choose exactly where approved media appears. Uploading alone never changes the website.</p></div><button type="button" onClick={() => void load({ sync: true })} className={buttonClass}>Refresh video processing</button></div>
    {error && <div className="mb-5"><ErrorState message={error} onRetry={() => void load()} /></div>}
    {uploadNote && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{uploadNote}</div>}
    <div role="tablist" aria-label="Media areas" className="mb-6 flex gap-2 overflow-x-auto border-b border-silver-300 pb-2"><TabButton active={tab === 'gallery'} onClick={() => setTab('gallery')}>Gallery</TabButton><TabButton active={tab === 'website'} onClick={() => setTab('website')}>Website</TabButton><TabButton active={tab === 'uploads'} onClick={() => setTab('uploads')}>Uploads / Media Library{unassigned.length ? ` (${unassigned.length} unassigned)` : ''}</TabButton></div>
    {!library ? <p className="text-sm text-navy-700">Loading media manager…</p> : <>
      {tab === 'gallery' && <section><div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4"><h2 className="font-semibold text-navy-950">Gallery Media</h2><p className="mt-1 text-sm text-navy-700">Each topic has five before/after jobs, four videos and ten grid photos. A ⭐ Featured position is reused outside the Gallery.</p></div><div role="tablist" aria-label="Gallery topics" className="mb-6 flex flex-wrap gap-2">{library.topics.map((item) => <TabButton key={item.key} active={topic === item.key} onClick={() => setTopic(item.key)}>{item.label}</TabButton>)}</div><SlotSection title="Before / After" slots={topicSlots.filter((slot) => slot.kind === 'before_after')} assets={assetsById} onAssign={openTarget} /><SlotSection title="Videos" slots={topicSlots.filter((slot) => slot.kind === 'video')} assets={assetsById} onAssign={openTarget} /><SlotSection title="Grid photos" slots={topicSlots.filter((slot) => slot.kind === 'photo')} assets={assetsById} onAssign={openTarget} /></section>}
      {tab === 'website' && <section><div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4"><h2 className="font-semibold text-navy-950">Website Media</h2><p className="mt-1 text-sm text-navy-700">Only important standalone media that may change over time. Gallery positions are not duplicated here.</p></div><div className="space-y-6">{websiteGroups.map(([page, slots]) => <div key={page}><h2 className="mb-3 text-lg font-semibold text-navy-950">{page}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{slots.map((slot) => <WebsiteSlotCard key={slot.id} slot={slot} asset={assetFor(slot.assignments, 'primary', assetsById)} onAssign={() => openTarget({ type: 'website', id: slot.id, label: `${slot.pageLabel} → ${slot.purposeLabel}`, role: 'primary' })} />)}</div></div>)}</div></section>}
      {tab === 'uploads' && <section className="space-y-6">
        {target && <AssignmentPicker target={target} assets={library.assets} gallerySlot={target.type === 'gallery' ? library.gallerySlots.find((slot) => slot.id === target.id) : undefined} busy={assigning} onCancel={() => setTarget(null)} onChoose={(asset) => void reviewAssignment(asset)} />}
        {assignmentPreview && <ImpactConfirmation preview={assignmentPreview} busy={assigning} onCancel={() => setAssignmentPreview(null)} onConfirm={() => void confirmAssignment()} />}
        <form onSubmit={uploadFiles} className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-navy-950">Add to your private media library</h2><p className="mt-1 max-w-2xl text-sm text-navy-700">Choose several photos or videos from your iPhone Photos library or Files. They remain unassigned and private until you deliberately place them in Gallery or Website Media.</p><label className="mt-4 block"><span className="text-sm font-semibold text-navy-900">Choose from Photos or Files</span><input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,video/mp4,video/quicktime,video/webm" onChange={(event) => setFiles(Array.from(event.target.files || []))} className={inputClass} /></label>{files.length > 0 && <p className="mt-2 text-sm text-navy-700">{files.length} file{files.length === 1 ? '' : 's'} ready. Nothing will be published yet.</p>}<button type="submit" disabled={uploading} className="mt-4 min-h-11 rounded-lg bg-navy-950 px-5 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60">{uploading ? 'Uploading safely…' : 'Upload to library'}</button></form>
        <div className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-navy-950">Media library</h2><p className="mt-1 text-sm text-navy-700">Old media is retained here even after a position is replaced.</p></div><span className="text-sm text-navy-700">{library.assets.length} items</span></div>{library.assets.length === 0 ? <div className="mt-5"><EmptyState title="No media yet" description="Upload a photo or video first. It will not change the website until you assign it." /></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{library.assets.map((asset) => <MediaCard key={asset.id} asset={asset} />)}</div>}</div>
      </section>}
    </>}
  </div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400 ${active ? 'bg-navy-950 text-white' : 'border border-silver-300 bg-white text-navy-900 hover:bg-silver-100'}`}>{children}</button>; }
function SlotSection({ title, slots, assets, onAssign }: { title: string; slots: GallerySlot[]; assets: Map<string, MediaAsset>; onAssign: (target: Target) => void }) { return <section className="mb-8"><h2 className="mb-3 text-lg font-semibold text-navy-950">{title}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{slots.map((slot) => <GallerySlotCard key={slot.id} slot={slot} assets={assets} onAssign={onAssign} />)}</div></section>; }
function GallerySlotCard({ slot, assets, onAssign }: { slot: GallerySlot; assets: Map<string, MediaAsset>; onAssign: (target: Target) => void }) { const featured = slot.usages.some((usage) => !usage.pageKey.startsWith('gallery-')); const before = assetFor(slot.assignments, 'before', assets); const after = assetFor(slot.assignments, 'after', assets); const primary = assetFor(slot.assignments, 'primary', assets); return <article className="overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-sm"><div className="flex items-start justify-between gap-3 border-b border-silver-200 p-4"><div><h3 className="font-semibold text-navy-950">{slot.code} {featured && <span className="ml-1 text-amber-600" aria-label="Featured outside the Gallery">⭐ Featured</span>}</h3><p className="mt-1 text-xs text-navy-700">{slot.label}</p></div></div>{slot.kind === 'before_after' ? <div className="grid grid-cols-2 gap-px bg-silver-200"><Preview asset={before} label="Before" /><Preview asset={after} label="After" /></div> : <Preview asset={primary} label={slot.kind === 'video' ? 'Video' : 'Photo'} />}<div className="p-4"><UsageList usages={slot.usages} /><div className="mt-4 flex flex-wrap gap-2">{slot.kind === 'before_after' ? <><button type="button" className={buttonClass} onClick={() => onAssign({ type: 'gallery', id: slot.id, label: `${slot.code} → Before`, role: 'before' })}>Replace before</button><button type="button" className={buttonClass} onClick={() => onAssign({ type: 'gallery', id: slot.id, label: `${slot.code} → After`, role: 'after' })}>Replace after</button></> : <button type="button" className={buttonClass} onClick={() => onAssign({ type: 'gallery', id: slot.id, label: slot.code, role: 'primary' })}>{primary ? 'Replace' : 'Assign media'}</button>}</div></div></article>; }
function WebsiteSlotCard({ slot, asset, onAssign }: { slot: WebsiteSlot; asset?: MediaAsset; onAssign: () => void }) { return <article className="overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-sm"><div className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">{slot.pageLabel}</p><h3 className="mt-1 font-semibold text-navy-950">{slot.purposeLabel}</h3><p className="mt-1 text-xs text-navy-700">{slot.description}</p></div><Preview asset={asset} label="Current media" /><div className="p-4"><UsageList usages={slot.usages} /><button type="button" className={`mt-4 ${buttonClass}`} onClick={onAssign}>{asset ? 'Replace' : 'Assign media'}</button></div></article>; }
function Preview({ asset, label }: { asset?: MediaAsset; label: string }) { const preview = asset?.imageUrl || (asset?.muxPlaybackId ? videoPoster(asset.muxPlaybackId) : null); return <div className="relative aspect-video bg-silver-100">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-xs text-navy-700">{label}: not assigned</div>}<span className="absolute bottom-2 left-2 rounded bg-navy-950/80 px-2 py-1 text-[11px] font-semibold text-white">{label}</span></div>; }
function UsageList({ usages }: { usages: MediaUsage[] }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-navy-700">Used on</p>{usages.length ? <ul className="mt-2 space-y-1 text-sm text-navy-900">{usages.map((usage) => <li key={usage.key}>• {usage.pageLabel} — {usage.componentLabel}</li>)}</ul> : <p className="mt-1 text-sm text-navy-700">Not used on a public page yet.</p>}</div>; }
function AssignmentPicker({ target, assets, gallerySlot, busy, onCancel, onChoose }: { target: Target; assets: MediaAsset[]; gallerySlot?: GallerySlot; busy: boolean; onCancel: () => void; onChoose: (asset: MediaAsset) => void }) { const available = assets.filter((asset) => asset.status === 'ready' && isCompatible(asset, gallerySlot)); return <section className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Assign media</p><h2 className="mt-1 text-lg font-semibold text-navy-950">Choose media for {target.label}</h2><p className="mt-1 text-sm text-navy-700">We will show every page affected before replacing anything.</p></div><button type="button" className={buttonClass} onClick={onCancel}>Cancel</button></div>{available.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{available.map((asset) => <article key={asset.id} className="overflow-hidden rounded-xl border border-sky-200 bg-white"><Preview asset={asset} label={asset.mediaType === 'video' ? 'Video' : 'Photo'} /><div className="p-3"><p className="line-clamp-2 text-sm font-semibold text-navy-950">{asset.title || 'Untitled upload'}</p><button type="button" disabled={busy} className={`mt-3 ${buttonClass}`} onClick={() => onChoose(asset)}>Use this media</button></div></article>)}</div> : <div className="mt-4"><EmptyState title="No compatible processed media" description="Upload a suitable photo or video first. It will stay unassigned until you return here." /></div>}</section>; }
function ImpactConfirmation({ preview, busy, onCancel, onConfirm }: { preview: AssignmentPreview; busy: boolean; onCancel: () => void; onConfirm: () => void }) { return <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Confirm assignment</p><h2 className="mt-1 text-lg font-semibold text-navy-950">{preview.replacement ? `Replace ${preview.target.label}?` : `Assign media to ${preview.target.label}?`}</h2><p className="mt-2 text-sm text-navy-800">{preview.replacement ? 'The old media remains safely in the library. These uses will switch together without a redeploy:' : 'This media will be used in these places:'}</p><UsageList usages={preview.impact} /><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-60" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : preview.replacement ? 'Confirm replacement' : 'Confirm assignment'}</button><button type="button" className={buttonClass} onClick={onCancel}>Go back</button></div></section>; }
function MediaCard({ asset }: { asset: MediaAsset }) { const preview = asset.imageUrl || (asset.muxPlaybackId ? videoPoster(asset.muxPlaybackId) : null); const statusClass = asset.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : asset.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'; return <article className="overflow-hidden rounded-xl border border-silver-300 bg-white"><div className="aspect-video bg-silver-100">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-navy-700">{asset.mediaType === 'video' ? 'Video processing' : 'Original upload waiting'}</div>}</div><div className="p-3"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 font-semibold text-navy-950">{asset.title || 'Untitled upload'}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>{asset.status}</span></div><p className="mt-1 text-xs text-navy-700">{asset.usages.length ? `${asset.usages.length} public use${asset.usages.length === 1 ? '' : 's'}` : 'Unassigned — not on the website'}</p>{asset.processingError && <p className="mt-2 text-xs text-red-700">{asset.processingError}</p>}</div></article>; }
