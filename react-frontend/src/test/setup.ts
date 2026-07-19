import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

// ponytail: jsdom has no createObjectURL; maplibre-gl calls it at import time
// to set up its worker. Stub it so any test importing maplibre-gl (directly
// or transitively via App/DashboardPage) doesn't crash just from loading it.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => '';
}

// ponytail: this jsdom build exposes no working localStorage — window has none,
// and Node's experimental globalThis.localStorage is a read-only stub that
// throws without --localstorage-file. AlertBanner and MapPanel read/write it,
// so replace both refs with an in-memory Storage.
if (!window.localStorage || typeof window.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  };
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
}

// ponytail: jsdom has no matchMedia; the sidebar's useIsMobile hook calls it
// on mount. Stub a "never matches" MediaQueryList so it doesn't crash.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
// ponytail: RTL's automatic cleanup needs vitest `globals: true`, which this
// project doesn't set (tests import afterEach explicitly instead). Do it here
// once for every test file instead of turning on globals.
afterEach(() => cleanup());
afterAll(() => server.close());
