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
