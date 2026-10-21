import '@testing-library/dom';
import { beforeEach } from 'vitest';

// jsdom does not implement these; the studio relies on them in the browser only.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!window.IntersectionObserver) {
  class MockObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error test shim
  window.IntersectionObserver = MockObserver;
}

beforeEach(() => {
  window.localStorage.clear();
});
