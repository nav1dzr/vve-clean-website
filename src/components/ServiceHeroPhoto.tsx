import type { ReactNode } from 'react';

/** A visible caption stays outside the photograph, so neither hides the other. */
export default function ServiceHeroPhoto({ src, alt, caption, detail }: {
  src: string;
  alt: string;
  caption: string;
  detail?: ReactNode;
}) {
  return (
    <figure className="service-photo">
      <img src={src} alt={alt} width={1536} height={1024} loading="eager" decoding="async" />
      <figcaption>
        <p className="font-display text-lg font-bold text-navy-950">{caption}</p>
        {detail && <p className="mt-1 text-sm leading-relaxed text-slate-600">{detail}</p>}
      </figcaption>
    </figure>
  );
}
