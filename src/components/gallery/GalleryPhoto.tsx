import { useState, type ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError'> & {
  alt: string;
  retryable?: boolean;
  openable?: boolean;
};

/** Preserve the real photo and its layout; never substitute an invented result. */
export default function GalleryPhoto(props: Props) {
  // A new published source must get a fresh load attempt, even in an open viewer.
  return <PhotoAttempt key={`${props.src}|${props.srcSet || ''}`} {...props} />;
}

function PhotoAttempt({ retryable = false, openable = false, className = '', alt, ...image }: Props) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!failed) {
    return <img {...image} key={attempt} alt={alt} className={className} onError={() => setFailed(true)} />;
  }
  return (
    <span className={`${className} flex min-h-32 flex-col items-center justify-center gap-3 bg-navy-950 p-5 text-center text-sm text-white`}>
      <span role="status">This photo could not be loaded.</span>
      <span className="max-w-md text-silver-200">{alt}</span>
      {retryable ? (
        <button type="button" className="min-h-11 rounded-lg border border-white/50 px-4 py-2 font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => { setAttempt((value) => value + 1); setFailed(false); }}>
          Try loading photo again
        </button>
      ) : openable ? <span className="text-silver-200">Open the photo to try again.</span> : null}
    </span>
  );
}
