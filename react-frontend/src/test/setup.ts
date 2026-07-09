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
