// React Router matches paths without regard to case and decodes escapes.
// Keep the matching rule in index.html's early tag guard in sync with this.
export function isPrivatePage(pathname = typeof window === 'undefined' ? '/' : window.location.pathname): boolean {
  try { return /^\/manage-booking(?:\/|$)/i.test(decodeURIComponent(pathname)); }
  catch { return true; }
}

export function canUseGoogleTags(): boolean {
  return typeof window !== 'undefined' && ['vveclean.co.uk', 'www.vveclean.co.uk'].includes(window.location.hostname) && !isPrivatePage();
}
