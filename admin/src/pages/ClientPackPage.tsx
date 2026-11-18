import { useEffect, useRef, useState } from 'react';
import type { PublicPack, PackStage } from '../types/clientPack';
import './ClientPackPage.css';

const stages: Record<PackStage, string> = { during: 'During cleaning', earlier: 'Earlier in treatment', later: 'Later in treatment', record: 'From the visit' };
const unavailable = 'This viewing link is unavailable or has expired. Please contact VVE Clean for a new link.';
export function readableDate(date: string) {
  const parsed = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}
export function extractPackToken(hash: string) {
  const raw = hash.replace(/^#/, '').replace(/^token=/, '');
  return /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : '';
}
export function PackBrand() {
  return <div className="pack-brand" aria-label="VVE Clean, Cleaning and Property Services"><div><strong>vve</strong><span>CLEAN</span></div><p>CLEANING &amp;<br />PROPERTY<br />SERVICES</p></div>;
}
function allowedUrl(url: string, review: boolean) {
  if (review && url.startsWith('/__hart_review__/')) return url;
  try { const target = new URL(url); return target.protocol === 'https:' && target.hostname.endsWith('.supabase.co') && !target.username && !target.password ? url : ''; } catch { return ''; }
}

export function ClientPackContents({ pack, review, refresh, refreshing }: { pack: PublicPack; review: boolean; refresh: () => void; refreshing: boolean }) {
  const pdf = pack.assets.find(a => a.kind === 'pdf');
  const photos = pack.assets.filter(a => a.kind === 'photo');
  const videos = pack.assets.filter(a => a.kind === 'video');
  const [mediaError, setMediaError] = useState(false);
  return <>
    {review && <div className="pack-review">OWNER PREVIEW · This page has not been published or sent.</div>}
    <header className="pack-header"><PackBrand /><span className="pack-header-note">Your service record</span></header>
    <main className="pack-main">
      <section className="pack-hero">
        <div className="pack-eyebrow">CLEANING COMPLETION REPORT</div>
        <h1>{pack.title}</h1>
        <p className="pack-lead">{readableDate(pack.serviceDate)}</p>
        <p className="pack-address">{pack.propertyAddress}</p>
        <p className="pack-summary">{pack.summary}</p>
        <div className="pack-hero-actions">{pdf && <a className="pack-button" href={allowedUrl(pdf.url, review)} target="_blank" rel="noopener noreferrer" download="VVE-Clean-Completion-Report.pdf">Download your report <span aria-hidden="true">↓</span></a>}<button className="pack-quiet-link" onClick={() => document.getElementById('visit-record')?.scrollIntoView({ behavior: 'smooth' })}>Explore the visit <span aria-hidden="true">↓</span></button></div>
      </section>
      <section className="pack-intro" id="visit-record"><div><div className="pack-eyebrow">THE WORK, DOCUMENTED</div><h2>A closer look at your clean</h2></div><p>A selection of photographs and videos from the visit. Captions identify the stage shown in each record.</p></section>
      {photos.length > 0 && <section aria-labelledby="pack-photos-title"><div className="pack-section-title"><h2 id="pack-photos-title">Photographs</h2><span>{photos.length} selected records</span></div><div className="pack-photo-grid">{photos.map(asset => <figure className="pack-photo" key={asset.id}><a href={allowedUrl(asset.url, review)} target="_blank" rel="noopener noreferrer" aria-label={`Open photograph: ${asset.caption}`}><img src={allowedUrl(asset.url, review)} alt={asset.caption || stages[asset.stage]} loading="lazy" onError={() => setMediaError(true)} /></a><figcaption><span className="pack-stage">{stages[asset.stage]}</span><p>{asset.caption}</p></figcaption></figure>)}</div></section>}
      {videos.length > 0 && <section className="pack-video-section" aria-labelledby="pack-videos-title"><div className="pack-section-title"><h2 id="pack-videos-title">Watch the work</h2><span>{videos.length} selected clips</span></div><div className="pack-video-grid">{videos.map(asset => <figure className="pack-video" key={asset.id}><video key={asset.url} controls playsInline preload="metadata" aria-label={asset.caption || 'Cleaning visit video'} onError={() => setMediaError(true)}><source src={allowedUrl(asset.url, review)} type={asset.mime} />Your browser does not support video playback. <a href={allowedUrl(asset.url, review)}>Open video</a></video><figcaption><span className="pack-stage">{stages[asset.stage]}</span><p>{asset.caption}</p></figcaption></figure>)}</div></section>}
      <section className="pack-help"><div><div className="pack-eyebrow">HERE TO HELP</div><h2>Questions about your report?</h2><p>Reply to your email or contact Navid at VVE Clean.</p><a href="mailto:contact@vveclean.co.uk">contact@vveclean.co.uk</a><span className="pack-help-divider"> · </span><a href="tel:+442080502233">020 8050 2233</a></div><div className="pack-reference">{pack.invoiceReference && <p>Related invoice<br /><strong>{pack.invoiceReference}</strong></p>}<p>Link available until<br /><strong>{readableDate(pack.expiresAt)}</strong></p></div></section>
      {!review && <div className="pack-refresh">{mediaError ? <p role="status">A file could not be loaded. Refresh access and try again.</p> : <p>Having trouble opening a file? Refresh access and try again.</p>}<button onClick={() => { setMediaError(false); refresh(); }} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh file access'}</button></div>}
    </main>
    <footer className="pack-footer"><span>VVE Clean · Cleaning &amp; Property Services</span><span>VVE Limited · Company No. 17234391</span></footer>
  </>;
}

export default function ClientPackPage() {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).get('review') === 'hart';
  const [token] = useState(() => extractPackToken(window.location.hash));
  const [pack, setPack] = useState<PublicPack | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const previousTitle = useRef(document.title);
  useEffect(() => {
    const titleToRestore = previousTitle.current;
    // Keep the secret in the fragment for reloads; never use query strings or browser storage.
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.append(meta);
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow,noarchive'; document.head.append(robots);
    return () => { meta.remove(); robots.remove(); document.title = titleToRestore; };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timer = window.setTimeout(() => controller.abort(), 20_000);
    setError(''); setLoading(true);
    if (!review && !token) { setError(unavailable); setLoading(false); window.clearTimeout(timer); return; }
    fetch(review ? '/__hart_review__/pack.json' : '/api/customers?resource=client-pack-view', { method: review ? 'GET' : 'POST', ...(review ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(response.status >= 500 ? 'The report could not be loaded just now. Please try again shortly.' : unavailable); const data = await response.json(); if (!Array.isArray(data.assets) || !data.assets.some((a: {kind?: string}) => a.kind === 'pdf')) throw new Error(unavailable); return data as PublicPack; })
      .then(data => { if (active) { setPack(data); document.title = `${data.title} | VVE Clean report`; } })
      .catch(e => { if (active) { setPack(null); setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'The request timed out. Please try again.'); } })
      .finally(() => { window.clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [review, token, attempt]);
  return <div className="client-pack">{pack ? <ClientPackContents pack={pack} review={review} refresh={() => setAttempt(a => a + 1)} refreshing={loading} /> : <><header className="pack-header"><PackBrand /></header><main className="pack-state" aria-live="polite"><div className="pack-eyebrow">YOUR SERVICE RECORD</div><h1>{loading ? 'Opening your report…' : 'Your report link'}</h1><p>{error || 'Your private report and visit records will appear here.'}</p>{!loading && <><a href="mailto:contact@vveclean.co.uk">Contact VVE Clean</a>{token && <button onClick={() => setAttempt(a => a + 1)}>Try again</button>}</>}</main></>}</div>;
}
