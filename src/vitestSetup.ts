import '@testing-library/jest-dom/vitest';

// jsdom has no IntersectionObserver implementation. Several components (e.g.
// the reveal-on-scroll hook used across the site) rely on it existing, even
// when it never actually fires in a test environment.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error — test-only global polyfill, not a full type-correct implementation.
globalThis.IntersectionObserver = MockIntersectionObserver;

// jsdom doesn't implement scrollIntoView. Several components call it
// directly (MobileStickyFooter, scrollToHashTarget) — stub it as a no-op so
// those code paths don't throw in tests that don't otherwise mock it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// jsdom doesn't implement window.scrollTo either — ScrollToTop calls it on
// every route change without a hash, which otherwise logs a "Not
// implemented" error to stderr in every test that exercises navigation.
window.scrollTo = function scrollTo() {} as typeof window.scrollTo;
