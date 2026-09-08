import { useState, type ReactNode } from 'react';

/** A visible caption stays outside the photograph, so neither hides the other. */
export default function ServiceHeroPhoto({ src, alt, caption, detail }: {
  src: string;
  alt: string;
  caption: string;
  detail?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="service-photo">
      {!failed && <img src={src} alt={alt} onError={() => setFailed(true)} width={1536} height={1024} loading="eager" decoding="async" />}
      <figcaption>
        <p className="font-display text-lg font-bold text-navy-950">{failed ? <a href="/gallery" className="underline underline-offset-4">See our cleaning results in the gallery</a> : caption}</p>
        {detail && !failed && <p className="mt-1 text-sm leading-relaxed text-slate-600">{detail}</p>}
      </figcaption>
    </figure>
  );
}
