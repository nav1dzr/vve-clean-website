import { useState } from 'react';
import { buildersJobPhotos, type BuildersJobPhoto, type BuildersPhotoSlot } from '../data/afterBuildersPhotos';

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
  const photo = buildersJobPhotos.hero;
  const [failed, setFailed] = useState('');
  if (!photo?.src || !photo.alt.trim() || failed === photo.src) return null;
  return <JobPhoto photo={photo} slot="hero" onError={() => setFailed(photo.src)} />;
}

export function AfterBuildersResults() {
  const { before, after } = buildersJobPhotos;
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
