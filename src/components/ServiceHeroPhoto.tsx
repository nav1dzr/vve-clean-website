import { useState, type ReactNode } from 'react';

/** Captions remain readable outside the photograph; unavailable images have a useful fallback. */
export default function ServiceHeroPhoto({ src, alt, caption, detail, srcSet, sizes, fallback }: {
  src: string;
  alt: string;
  caption: string;
  detail?: ReactNode;
  srcSet?: string;
  sizes?: string;
  fallback?: { src: string; alt: string; caption: string };
}) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const primaryFailed = failedSources.includes(src);
  const displayed = !primaryFailed ? { src, alt, caption } : fallback && !failedSources.includes(fallback.src) ? fallback : null;
  return (
    <figure className="service-photo">
      {displayed && <img src={displayed.src} srcSet={!primaryFailed ? srcSet : undefined} sizes={sizes || '(min-width: 1024px) 50vw, 100vw'} alt={displayed.alt} onError={() => setFailedSources(previous => [...previous, displayed.src])} width={1536} height={1024} loading="eager" decoding="async" />}
      <figcaption>
        <p className="font-display text-lg font-bold text-navy-950">{displayed ? displayed.caption : <a href="/gallery" className="underline underline-offset-4">See our cleaning results in the gallery</a>}</p>
        {detail && displayed && <div className="mt-1 text-sm leading-relaxed text-slate-600">{detail}</div>}
      </figcaption>
    </figure>
  );
}
