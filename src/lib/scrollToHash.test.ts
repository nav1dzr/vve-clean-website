import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollToHashTarget } from './scrollToHash';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

describe('scrollToHashTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false and does nothing when the target does not exist', () => {
    expect(scrollToHashTarget('#nope')).toBe(false);
  });

  it('accepts the hash with or without a leading #', () => {
    document.body.innerHTML = '<div id="quote"></div>';
    mockMatchMedia(false);
    expect(scrollToHashTarget('quote')).toBe(true);
  });

  it('smooth-scrolls and focuses the target, clearing the tabindex it added on blur', () => {
    document.body.innerHTML = '<section id="quote"></section>';
    mockMatchMedia(false);
    const el = document.getElementById('quote')!;
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    const focusSpy = vi.spyOn(el, 'focus');

    expect(scrollToHashTarget('#quote')).toBe(true);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(el.getAttribute('tabindex')).toBe('-1');
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    el.dispatchEvent(new FocusEvent('blur'));
    expect(el.hasAttribute('tabindex')).toBe(false);
  });

  it('uses an instant jump when the user prefers reduced motion', () => {
    document.body.innerHTML = '<section id="quote"></section>';
    mockMatchMedia(true);
    const el = document.getElementById('quote')!;
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;

    scrollToHashTarget('#quote');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('leaves a pre-existing tabindex alone after blur', () => {
    document.body.innerHTML = '<section id="quote" tabindex="0"></section>';
    mockMatchMedia(false);
    const el = document.getElementById('quote')!;
    el.scrollIntoView = vi.fn();

    scrollToHashTarget('#quote');
    el.dispatchEvent(new FocusEvent('blur'));

    expect(el.getAttribute('tabindex')).toBe('0');
  });
});
