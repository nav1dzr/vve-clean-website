// Shared scroll+focus behaviour for "#quote"-style in-page anchors that are
// reached via React Router navigation (Link/navigate), where the browser's
// native fragment-scroll never fires because the click was intercepted.
// Sticky-nav offset is handled by each target's `scroll-mt-*` class; this
// helper only handles the scroll itself and moving keyboard/AT focus.
export function scrollToHashTarget(hash: string): boolean {
  const id = hash.replace(/^#/, '');
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });

  // Move focus to the section so screen-reader/keyboard users land where the
  // page visually jumped to. Sections aren't natively focusable, so give them
  // a temporary tabindex and drop it again on blur — this never traps focus,
  // it just makes the one-off landing announce correctly.
  const hadTabIndex = el.hasAttribute('tabindex');
  if (!hadTabIndex) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  if (!hadTabIndex) {
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  }
  return true;
}
