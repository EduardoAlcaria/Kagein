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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
// ponytail: RTL's automatic cleanup needs vitest `globals: true`, which this
// project doesn't set (tests import afterEach explicitly instead). Do it here
// once for every test file instead of turning on globals.
afterEach(() => cleanup());
afterAll(() => server.close());
