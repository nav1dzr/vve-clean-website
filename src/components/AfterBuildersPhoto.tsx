import { useState } from 'react';
import { Camera } from 'lucide-react';

// Replace a null source with an approved real job photo, then add its factual
// alt text/caption. Empty or failed photos stay explicitly labelled placeholders.
const PHOTOS = {
  hero: { src: null as string | null, alt: '', title: 'The finished space', caption: '' },
  before: { src: null as string | null, alt: '', title: 'Before the clean', caption: '' },
  after: { src: null as string | null, alt: '', title: 'After the clean', caption: '' },
};

export default function AfterBuildersPhoto({ slot }: { slot: keyof typeof PHOTOS }) {
  const photo = PHOTOS[slot];
  const [failed, setFailed] = useState(false);
  return <figure className={`builders-photo builders-photo--${slot}`} data-photo-slot={`after-builders-${slot}`}>
    {photo.src && !failed ? <img src={photo.src} alt={photo.alt} loading={slot === 'hero' ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} /> :
      <div className="builders-photo-placeholder"><Camera size={36} strokeWidth={1.3} aria-hidden="true" /><span>{photo.title}</span><small>Project photo to be added</small></div>}
    {photo.src && !failed && photo.caption && <figcaption>{photo.caption}</figcaption>}
  </figure>;
}
