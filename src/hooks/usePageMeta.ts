import { useEffect } from 'react';

const BASE_URL = 'https://www.vveclean.co.uk';

// prerender.mjs sets the correct <title>/description/canonical for the
// initial server-rendered HTML of every route, but that is a build-time,
// per-file step — it cannot run again for an in-app (client-side) navigation
// between trust pages, which never re-requests the server. Without this,
// navigating SPA-style from / to /about left the homepage's title and
// canonical in place. This hook re-applies them on mount and restores
// whatever was there before on unmount, so a route that doesn't call it
// (e.g. HomePage, which relies solely on the prerendered head) is unaffected.
export function usePageMeta(title: string, description: string, path: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const descriptionTag = document.querySelector('meta[name="description"]');
    const prevDescription = descriptionTag?.getAttribute('content') ?? null;
    descriptionTag?.setAttribute('content', description);

    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonicalTag?.getAttribute('href') ?? null;
    canonicalTag?.setAttribute('href', `${BASE_URL}${path}`);

    return () => {
      document.title = prevTitle;
      if (prevDescription !== null) descriptionTag?.setAttribute('content', prevDescription);
      if (prevCanonical !== null) canonicalTag?.setAttribute('href', prevCanonical);
    };
  }, [title, description, path]);
}
