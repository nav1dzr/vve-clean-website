import { useState } from 'react';
import { buildersJobPhotos, type BuildersJobPhoto, type BuildersPhotoSlot } from '../data/afterBuildersPhotos';
import { useWebsiteMediaPosition } from '../lib/websiteMediaPositions';
import type { GalleryBeforeAfterItem, GalleryPhotoItem } from '../data/galleryMedia';

function JobPhoto({ photo, slot, onError }: { photo: BuildersJobPhoto; slot: BuildersPhotoSlot; onError: () => void }) {
  return (
    <figure className={`builders-photo builders-photo--${slot}`} data-photo-slot={`after-builders-${slot}`}>
      <img src={photo.src} alt={photo.alt} loading={slot === 'hero' ? 'eager' : 'lazy'} decoding="async" onError={onError} />
      {(slot !== 'hero' || photo.caption) && (
        <figcaption>
          {slot !== 'hero' && <strong>{slot === 'before' ? 'Before the clean' : 'After the clean'}{photo.caption && ' · '}</strong>}
          {photo.caption}
        </figcaption>
      )}
    </figure>
  );
}

export default function AfterBuildersPhoto() {
  const original = buildersJobPhotos.hero;
  const selected = useWebsiteMediaPosition<GalleryPhotoItem>('after-builders-hero', original?.src && original.alt.trim() ? { type: 'photo', id: 'builders-hero', src: original.src, alt: original.alt, label: original.caption || '' } : null);
  const photo = selected ? { src: selected.src, alt: selected.alt, caption: selected.label } : null;
  const [failed, setFailed] = useState('');
  if (!photo?.src || !photo.alt.trim() || failed === photo.src) return null;
  return <JobPhoto photo={photo} slot="hero" onError={() => setFailed(photo.src)} />;
}

export function AfterBuildersResults() {
  const original = buildersJobPhotos;
  const selected = useWebsiteMediaPosition<GalleryBeforeAfterItem>('after-builders-comparison', original.before?.src && original.after?.src && original.before.alt.trim() && original.after.alt.trim() ? { type: 'before-after', id: 'builders-comparison', label: 'Before and after the builders’ clean', before: original.before.src, after: original.after.src, beforeAlt: original.before.alt, afterAlt: original.after.alt } : null);
  const before = selected ? { src: selected.before, alt: selected.beforeAlt, caption: original.before?.src === selected.before ? original.before.caption : '' } : null;
  const after = selected ? { src: selected.after, alt: selected.afterAlt, caption: original.after?.src === selected.after ? original.after.caption : '' } : null;
  const [failed, setFailed] = useState('');
  if (!before?.src || !after?.src || !before.alt.trim() || !after.alt.trim() || failed === before.src || failed === after.src) return null;
  return (
    <section id="builders-results" className="builders-section builders-results" aria-labelledby="builders-results-title">
      <div className="builders-wrap">
        <h2 id="builders-results-title">Before and after the builders’ clean</h2>
        <div className="builders-photo-pair">
          <JobPhoto slot="before" photo={before} onError={() => setFailed(before.src)} />
          <JobPhoto slot="after" photo={after} onError={() => setFailed(after.src)} />
        </div>
      </div>
    </section>
  );
}
