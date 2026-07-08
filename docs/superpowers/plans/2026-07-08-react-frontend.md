# react-frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React/TypeScript dashboard UI: login, a map showing each shared person's latest location, click-through location history/trail, and stale-location alerts — talking only to spring-bff.

**Architecture:** Single Vite + React SPA. Feature folders: `auth` (in-memory credential store + Basic-auth fetch wrapper + login gate), `api` (typed client mirroring spring-bff's confirmed DTOs), `hooks` (react-query wrappers per endpoint), `components` (map, sidebar, alerts, forms), `pages` (route-level composition). Served in production by an nginx container that also reverse-proxies `/api/*` to `spring-bff:8080` — the browser only ever talks to one origin, no CORS.

**Tech Stack:** Vite 5, React 18, TypeScript 5, react-router-dom 6, @tanstack/react-query 5, maplibre-gl 4 (MapLibre GL JS directly — no wrapper package), Tailwind CSS 3. Testing: Vitest + React Testing Library + MSW (mock service worker) + jsdom.

## Global Constraints

- Frontend never talks to python-findmy-service or Apple directly — only to spring-bff, always via relative `/api/...` paths (never an absolute spring-bff URL). In dev, `vite.config.ts` proxies `/api` to `http://localhost:8080`; in prod, nginx does the same proxy — so `authFetch` code never changes between environments.
- Confirmed backend contract, do not deviate (verified against the actual spring-bff source this session):
  - `GET /api/people` → `PersonSummaryDto[]` = `{ id: number, name: string, latest: PersonLocationDto | null }`
  - `GET /api/people/{id}/locations` → `PersonLocationDto[]` = `{ latitude: number | null, longitude: number | null, capturedAt: string }`, most recent first
  - `GET /api/alerts` → `AlertEventDto[]` = `{ id: number, personId: number, type: string, message: string, triggeredAt: string }`
  - `POST /api/accounts` body `{ appleId: string, password: string }` → `{ "status": "active" | "2fa_required" }`
  - `POST /api/accounts/{appleId}/2fa` body `{ code: string }` → `{ "status": "active" }`
  - All endpoints require HTTP Basic auth (single dashboard user).
- The dashboard login form authenticates against the dashboard's own hardcoded user (`dashboard.username`/`password-hash` in spring-bff) — it is NOT an Apple ID login. Apple ID credentials are only ever entered on the Settings page and only ever sent to `POST /api/accounts`.
- Credential storage: dashboard username/password live in memory only (a module-level store), never `localStorage`/`sessionStorage`/cookies. The only thing persisted client-side is a non-sensitive "last seen alert id" counter for the alert banner.
- Any `401` response clears the in-memory credential, which reactively redirects to `/login` (no manual navigation call needed at call sites).
- One file changed = one commit = one push (repo convention). No AI attribution in commit messages.
- Directory: `react-frontend/` at the repo root, alongside `python-findmy-service/` and `spring-bff/`.
- Repo: `https://github.com/EduardoAlcaria/Kagein`.

## File Structure

```
react-frontend/
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.js
  postcss.config.js
  index.html
  .gitignore
  .dockerignore
  Dockerfile
  nginx.conf
  src/
    main.tsx
    App.tsx
    App.test.tsx
    index.css
    auth/
      credentialStore.ts
      authFetch.ts
      authFetch.test.ts
      AuthContext.tsx
      ProtectedRoute.tsx
      auth.test.tsx
    api/
      types.ts
      client.ts
      client.test.ts
    hooks/
      usePeople.ts
      usePeople.test.tsx
      usePersonLocations.ts
      usePersonLocations.test.tsx
      useAlerts.ts
      useAlerts.test.tsx
    components/
      PeopleSidebar.tsx
      PeopleSidebar.test.tsx
      MapView.tsx
      MapView.test.tsx
      LocationHistoryList.tsx
      AlertsPanel.tsx
      AlertBanner.tsx
      AlertBanner.test.tsx
      AccountSettingsForm.tsx
      AccountSettingsForm.test.tsx
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      DashboardPage.test.tsx
      SettingsPage.tsx
    test/
      setup.ts
      queryClient.tsx
      mocks/
        handlers.ts
        server.ts
```

---

## Task 1: Vite/TS/Tailwind/Vitest scaffold

**Files:**
- Create: `react-frontend/package.json`
- Create: `react-frontend/tsconfig.json`
- Create: `react-frontend/vite.config.ts`
- Create: `react-frontend/tailwind.config.js`
- Create: `react-frontend/postcss.config.js`
- Create: `react-frontend/index.html`
- Create: `react-frontend/.gitignore`
- Create: `react-frontend/src/main.tsx`
- Create: `react-frontend/src/index.css`
- Create: `react-frontend/src/App.tsx`
- Create: `react-frontend/src/App.test.tsx`
- Create: `react-frontend/src/test/setup.ts`

**Interfaces:**
- Produces: a bootable Vite React app with Tailwind and a working Vitest + Testing Library setup — every later task builds on this.

- [ ] **Step 1: Create the scaffold files**

```json
// react-frontend/package.json
{
  "name": "react-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "@tanstack/react-query": "^5.56.2",
    "maplibre-gl": "^4.7.1",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.7.4",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "msw": "^2.4.9",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

```json
// react-frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

```ts
// react-frontend/vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

```js
// react-frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

```js
// react-frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```html
<!-- react-frontend/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Find My Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```
# react-frontend/.gitignore
node_modules
dist
dist-ssr
*.local
```

```tsx
// react-frontend/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```css
/* react-frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```ts
// react-frontend/src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing test**

```tsx
// react-frontend/src/App.tsx
function App() {
  return (
    <main>
      <h1>Find My Dashboard</h1>
    </main>
  );
}

export default App;
```

```tsx
// react-frontend/src/App.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the dashboard heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Find My Dashboard' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Install and run the test**

Run: `cd react-frontend && npm install && npm run test`
Expected: `PASS` — 1 test passed. This also generates `package-lock.json`.

- [ ] **Step 4: Commit**

```bash
git add react-frontend/package.json && git commit -m "Add react-frontend package.json" -q && git push -q
git add react-frontend/package-lock.json && git commit -m "Add react-frontend package-lock.json" -q && git push -q
git add react-frontend/tsconfig.json && git commit -m "Add react-frontend tsconfig" -q && git push -q
git add react-frontend/vite.config.ts && git commit -m "Add react-frontend vite config" -q && git push -q
git add react-frontend/tailwind.config.js && git commit -m "Add react-frontend tailwind config" -q && git push -q
git add react-frontend/postcss.config.js && git commit -m "Add react-frontend postcss config" -q && git push -q
git add react-frontend/index.html && git commit -m "Add react-frontend index.html" -q && git push -q
git add react-frontend/.gitignore && git commit -m "Add react-frontend gitignore" -q && git push -q
git add react-frontend/src/main.tsx && git commit -m "Add react-frontend entry point" -q && git push -q
git add react-frontend/src/index.css && git commit -m "Add react-frontend tailwind directives" -q && git push -q
git add react-frontend/src/App.tsx && git commit -m "Add App root component" -q && git push -q
git add react-frontend/src/App.test.tsx && git commit -m "Add App smoke test" -q && git push -q
git add react-frontend/src/test/setup.ts && git commit -m "Add vitest jest-dom setup" -q && git push -q
```

---

## Task 2: API types, typed client, and Basic-auth fetch wrapper

**Files:**
- Create: `react-frontend/src/auth/credentialStore.ts`
- Create: `react-frontend/src/auth/authFetch.ts`
- Create: `react-frontend/src/auth/authFetch.test.ts`
- Create: `react-frontend/src/api/types.ts`
- Create: `react-frontend/src/api/client.ts`
- Create: `react-frontend/src/api/client.test.ts`
- Create: `react-frontend/src/test/mocks/handlers.ts`
- Create: `react-frontend/src/test/mocks/server.ts`
- Modify: `react-frontend/src/test/setup.ts`

**Interfaces:**
- Produces: `getCredential()/setCredential()/clearCredential()/subscribe()` (`auth/credentialStore.ts`), `authFetch(input, init?)` (`auth/authFetch.ts`), and typed client functions `fetchPeople()`, `fetchPersonLocations(personId)`, `fetchAlerts()`, `registerAccount(request)`, `submitTwoFactorCode(appleId, code)` (`api/client.ts`) — every later task consumes these by name.

- [ ] **Step 1: Write the failing tests**

```ts
// react-frontend/src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/people', () => HttpResponse.json([])),
  http.get('/api/alerts', () => HttpResponse.json([])),
];
```

```ts
// react-frontend/src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```ts
// react-frontend/src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```ts
// react-frontend/src/auth/authFetch.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { authFetch } from './authFetch';
import { clearCredential, getCredential, setCredential } from './credentialStore';

describe('authFetch', () => {
  beforeEach(() => {
    setCredential({ username: 'admin', password: 'hunter2' });
  });

  afterEach(() => {
    clearCredential();
  });

  it('attaches a Basic auth header built from the stored credential', async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get('/api/ping', ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await authFetch('/api/ping');

    expect(receivedAuth).toBe(`Basic ${btoa('admin:hunter2')}`);
  });

  it('clears the stored credential on a 401 response', async () => {
    server.use(http.get('/api/ping', () => new HttpResponse(null, { status: 401 })));

    await authFetch('/api/ping');

    expect(getCredential()).toBeNull();
  });
});
```

```ts
// react-frontend/src/api/client.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { setCredential } from '../auth/credentialStore';
import {
  fetchAlerts,
  fetchPeople,
  fetchPersonLocations,
  registerAccount,
  submitTwoFactorCode,
} from './client';

describe('api client', () => {
  beforeEach(() => {
    setCredential({ username: 'admin', password: 'hunter2' });
  });

  it('fetches people', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
    );

    const people = await fetchPeople();

    expect(people).toEqual([{ id: 1, name: 'Jane Doe', latest: null }]);
  });

  it('fetches a person location history', async () => {
    server.use(
      http.get('/api/people/1/locations', () =>
        HttpResponse.json([{ latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' }]),
      ),
    );

    const locations = await fetchPersonLocations(1);

    expect(locations).toHaveLength(1);
    expect(locations[0].latitude).toBe(37.33);
  });

  it('fetches alerts', async () => {
    server.use(
      http.get('/api/alerts', () =>
        HttpResponse.json([
          { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'stale', triggeredAt: '2026-07-06T12:00:00Z' },
        ]),
      ),
    );

    const alerts = await fetchAlerts();

    expect(alerts[0].type).toBe('STALE_UPDATE');
  });

  it('registers an account', async () => {
    server.use(http.post('/api/accounts', () => HttpResponse.json({ status: '2fa_required' })));

    const result = await registerAccount({ appleId: 'a@b.com', password: 'pw' });

    expect(result.status).toBe('2fa_required');
  });

  it('submits a 2fa code', async () => {
    server.use(
      http.post('/api/accounts/a%40b.com/2fa', () => HttpResponse.json({ status: 'active' })),
    );

    const result = await submitTwoFactorCode('a@b.com', '123456');

    expect(result.status).toBe('active');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `credentialStore`/`authFetch`/`client` modules don't exist yet.

- [ ] **Step 3: Implement**

```ts
// react-frontend/src/auth/credentialStore.ts
export interface Credential {
  username: string;
  password: string;
}

type Listener = () => void;

let credential: Credential | null = null;
const listeners = new Set<Listener>();

export function getCredential(): Credential | null {
  return credential;
}

export function setCredential(next: Credential): void {
  credential = next;
  listeners.forEach((listener) => listener());
}

export function clearCredential(): void {
  credential = null;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

```ts
// react-frontend/src/auth/authFetch.ts
import { clearCredential, getCredential } from './credentialStore';

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const credential = getCredential();
  const headers = new Headers(init.headers);
  if (credential) {
    headers.set('Authorization', `Basic ${btoa(`${credential.username}:${credential.password}`)}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearCredential();
  }

  return response;
}
```

```ts
// react-frontend/src/api/types.ts
export interface PersonLocationDto {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
}

export interface PersonSummaryDto {
  id: number;
  name: string;
  latest: PersonLocationDto | null;
}

export interface AlertEventDto {
  id: number;
  personId: number;
  type: string;
  message: string;
  triggeredAt: string;
}

export interface RegisterAccountRequest {
  appleId: string;
  password: string;
}

export interface AccountStatusResponse {
  status: 'active' | '2fa_required';
}
```

```ts
// react-frontend/src/api/client.ts
import { authFetch } from '../auth/authFetch';
import type {
  AccountStatusResponse,
  AlertEventDto,
  PersonLocationDto,
  PersonSummaryDto,
  RegisterAccountRequest,
} from './types';

export async function fetchPeople(): Promise<PersonSummaryDto[]> {
  const response = await authFetch('/api/people');
  return response.json();
}

export async function fetchPersonLocations(personId: number): Promise<PersonLocationDto[]> {
  const response = await authFetch(`/api/people/${personId}/locations`);
  return response.json();
}

export async function fetchAlerts(): Promise<AlertEventDto[]> {
  const response = await authFetch('/api/alerts');
  return response.json();
}

export async function registerAccount(
  request: RegisterAccountRequest,
): Promise<AccountStatusResponse> {
  const response = await authFetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function submitTwoFactorCode(
  appleId: string,
  code: string,
): Promise<AccountStatusResponse> {
  const response = await authFetch(`/api/accounts/${encodeURIComponent(appleId)}/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return response.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/auth/credentialStore.ts && git commit -m "Add in-memory credential store" -q && git push -q
git add react-frontend/src/auth/authFetch.ts && git commit -m "Add Basic-auth fetch wrapper" -q && git push -q
git add react-frontend/src/auth/authFetch.test.ts && git commit -m "Add authFetch tests" -q && git push -q
git add react-frontend/src/api/types.ts && git commit -m "Add API DTO types" -q && git push -q
git add react-frontend/src/api/client.ts && git commit -m "Add typed API client" -q && git push -q
git add react-frontend/src/api/client.test.ts && git commit -m "Add API client tests" -q && git push -q
git add react-frontend/src/test/mocks/handlers.ts && git commit -m "Add MSW request handlers" -q && git push -q
git add react-frontend/src/test/mocks/server.ts && git commit -m "Add MSW test server" -q && git push -q
git add react-frontend/src/test/setup.ts && git commit -m "Wire MSW lifecycle into vitest setup" -q && git push -q
```

---

## Task 3: Auth context, protected routes, login page

**Files:**
- Create: `react-frontend/src/auth/AuthContext.tsx`
- Create: `react-frontend/src/auth/ProtectedRoute.tsx`
- Create: `react-frontend/src/auth/auth.test.tsx`
- Create: `react-frontend/src/pages/LoginPage.tsx`
- Create: `react-frontend/src/pages/DashboardPage.tsx`
- Create: `react-frontend/src/pages/SettingsPage.tsx`
- Modify: `react-frontend/src/App.tsx`
- Modify: `react-frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `getCredential`, `setCredential`, `clearCredential`, `subscribe` from `auth/credentialStore.ts` (Task 2).
- Produces: `AuthProvider`, `useAuth()` returning `{ credential, login, logout }` (`auth/AuthContext.tsx`), `ProtectedRoute` (`auth/ProtectedRoute.tsx`) — Task 4+ wrap `DashboardPage`/`SettingsPage` behind it.

- [ ] **Step 1: Write the failing tests**

```tsx
// react-frontend/src/auth/auth.test.tsx
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { clearCredential } from './credentialStore';

function renderApp() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('auth flow', () => {
  afterEach(() => clearCredential());

  it('redirects to /login when no credential is stored', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Find My Dashboard' })).toBeInTheDocument();
  });

  it('logs in and reaches the protected route', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `AuthContext`/`ProtectedRoute`/`LoginPage` modules don't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/auth/AuthContext.tsx
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import {
  clearCredential,
  getCredential,
  setCredential,
  subscribe,
  type Credential,
} from './credentialStore';

interface AuthContextValue {
  credential: Credential | null;
  login: (credential: Credential) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const credential = useSyncExternalStore(subscribe, getCredential);

  const value: AuthContextValue = {
    credential,
    login: setCredential,
    logout: clearCredential,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

```tsx
// react-frontend/src/auth/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { credential } = useAuth();
  if (!credential) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
```

```tsx
// react-frontend/src/pages/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login({ username, password });
    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold">Find My Dashboard</h1>
        <input
          aria-label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Username"
        />
        <input
          aria-label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Password"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">
          Log in
        </button>
      </form>
    </main>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
export function DashboardPage() {
  return <div>Dashboard content</div>;
}
```

```tsx
// react-frontend/src/pages/SettingsPage.tsx
export function SettingsPage() {
  return <div>Settings content</div>;
}
```

```tsx
// react-frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

```tsx
// react-frontend/src/App.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Find My Dashboard' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/auth/AuthContext.tsx && git commit -m "Add auth context" -q && git push -q
git add react-frontend/src/auth/ProtectedRoute.tsx && git commit -m "Add protected route gate" -q && git push -q
git add react-frontend/src/auth/auth.test.tsx && git commit -m "Add auth flow integration test" -q && git push -q
git add react-frontend/src/pages/LoginPage.tsx && git commit -m "Add login page" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Add dashboard page placeholder" -q && git push -q
git add react-frontend/src/pages/SettingsPage.tsx && git commit -m "Add settings page placeholder" -q && git push -q
git add react-frontend/src/App.tsx && git commit -m "Wire router and auth into App" -q && git push -q
git add react-frontend/src/App.test.tsx && git commit -m "Update App test for router redirect" -q && git push -q
```

---

## Task 4: react-query provider, usePeople, PeopleSidebar

**Files:**
- Create: `react-frontend/src/test/queryClient.tsx`
- Create: `react-frontend/src/hooks/usePeople.ts`
- Create: `react-frontend/src/hooks/usePeople.test.tsx`
- Create: `react-frontend/src/components/PeopleSidebar.tsx`
- Create: `react-frontend/src/components/PeopleSidebar.test.tsx`
- Modify: `react-frontend/src/App.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `fetchPeople()` from `api/client.ts` (Task 2).
- Produces: `usePeople()` (react-query hook returning `{ data: PersonSummaryDto[] | undefined, ... }`), `PeopleSidebar({ people, selectedPersonId, onSelectPerson })` — Task 5/6/7 build on both.

- [ ] **Step 1: Write the failing tests**

```tsx
// react-frontend/src/test/queryClient.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

export function TestQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}
```

```tsx
// react-frontend/src/hooks/usePeople.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { usePeople } from './usePeople';

describe('usePeople', () => {
  it('loads people from GET /api/people', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
    );

    const { result } = renderHook(() => usePeople(), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].name).toBe('Jane Doe');
  });
});
```

```tsx
// react-frontend/src/components/PeopleSidebar.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeopleSidebar } from './PeopleSidebar';

const people = [
  {
    id: 1,
    name: 'Jane Doe',
    latest: { latitude: 37.33, longitude: -122.0, capturedAt: new Date().toISOString() },
  },
  { id: 2, name: 'No Location', latest: null },
];

describe('PeopleSidebar', () => {
  it('renders each person with a last-seen label', () => {
    render(<PeopleSidebar people={people} selectedPersonId={null} onSelectPerson={vi.fn()} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('no location yet')).toBeInTheDocument();
  });

  it('calls onSelectPerson when a row is clicked', async () => {
    const onSelectPerson = vi.fn();
    const user = userEvent.setup();
    render(<PeopleSidebar people={people} selectedPersonId={null} onSelectPerson={onSelectPerson} />);

    await user.click(screen.getByText('Jane Doe'));

    expect(onSelectPerson).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `usePeople`/`PeopleSidebar` modules don't exist yet.

- [ ] **Step 3: Implement**

```ts
// react-frontend/src/hooks/usePeople.ts
import { useQuery } from '@tanstack/react-query';
import { fetchPeople } from '../api/client';

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: fetchPeople,
    refetchInterval: 30_000,
  });
}
```

```tsx
// react-frontend/src/components/PeopleSidebar.tsx
import type { PersonSummaryDto } from '../api/types';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

interface PeopleSidebarProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
}

export function PeopleSidebar({ people, selectedPersonId, onSelectPerson }: PeopleSidebarProps) {
  return (
    <ul className="flex w-64 flex-col gap-1 overflow-y-auto border-r p-2">
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onSelectPerson(person.id)}
            className={`w-full rounded px-3 py-2 text-left ${
              person.id === selectedPersonId ? 'bg-blue-100' : 'hover:bg-gray-100'
            }`}
          >
            <div className="font-medium">{person.name}</div>
            <div className="text-sm text-gray-500">
              {person.latest ? relativeTime(person.latest.capturedAt) : 'no location yet'}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { PeopleSidebar } from '../components/PeopleSidebar';

export function DashboardPage() {
  const { data: people } = usePeople();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  return (
    <div className="flex h-screen">
      <PeopleSidebar
        people={people ?? []}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
      />
      <div className="flex-1" />
    </div>
  );
}
```

```tsx
// react-frontend/src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/test/queryClient.tsx && git commit -m "Add react-query test wrapper" -q && git push -q
git add react-frontend/src/hooks/usePeople.ts && git commit -m "Add usePeople hook" -q && git push -q
git add react-frontend/src/hooks/usePeople.test.tsx && git commit -m "Add usePeople tests" -q && git push -q
git add react-frontend/src/components/PeopleSidebar.tsx && git commit -m "Add PeopleSidebar component" -q && git push -q
git add react-frontend/src/components/PeopleSidebar.test.tsx && git commit -m "Add PeopleSidebar tests" -q && git push -q
git add react-frontend/src/App.tsx && git commit -m "Wire react-query provider into App" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire PeopleSidebar into DashboardPage" -q && git push -q
```

---

## Task 5: MapView with per-person markers

**Files:**
- Create: `react-frontend/src/components/MapView.tsx`
- Create: `react-frontend/src/components/MapView.test.tsx`
- Create: `react-frontend/src/pages/DashboardPage.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `PersonSummaryDto`, `PersonLocationDto` from `api/types.ts` (Task 2).
- Produces: `MapView({ people, selectedPersonId, onSelectPerson, trail })` — Task 6 extends `trail` handling, Task 7 doesn't touch this file.

- [ ] **Step 1: Write the failing tests**

```tsx
// react-frontend/src/components/MapView.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MapView } from './MapView';

const markerInstances: Array<{ options: { color: string }; element: HTMLElement }> = [];
const mapInstance = {
  on: vi.fn(),
  remove: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getSource: vi.fn(() => undefined),
};

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => mapInstance),
  Marker: vi.fn().mockImplementation((options: { color: string }) => {
    const element = document.createElement('div');
    const instance = {
      options,
      element,
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      getElement: () => element,
    };
    markerInstances.push(instance);
    return instance;
  }),
}));

const people = [
  {
    id: 1,
    name: 'Jane Doe',
    latest: { latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' },
  },
  { id: 2, name: 'No Location', latest: null },
];

describe('MapView', () => {
  beforeEach(() => {
    markerInstances.length = 0;
  });

  it('creates one marker per person with a known location', () => {
    render(<MapView people={people} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    expect(markerInstances).toHaveLength(1);
  });

  it('notifies onSelectPerson when a marker is clicked', () => {
    const onSelectPerson = vi.fn();
    render(<MapView people={people} selectedPersonId={null} onSelectPerson={onSelectPerson} trail={[]} />);

    markerInstances[0].element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSelectPerson).toHaveBeenCalledWith(1);
  });
});
```

```tsx
// react-frontend/src/pages/DashboardPage.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { DashboardPage } from './DashboardPage';

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    remove: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(() => undefined),
  })),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getElement: () => document.createElement('div'),
  })),
}));

describe('DashboardPage', () => {
  it('renders the people sidebar from GET /api/people', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
    );

    render(<DashboardPage />, { wrapper: TestQueryProvider });

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `MapView` module doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/MapView.tsx
import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const TRAIL_SOURCE_ID = 'person-trail';
const TRAIL_LAYER_ID = 'person-trail-line';

interface MapViewProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
}

export function MapView({ people, selectedPersonId, onSelectPerson, trail }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 0],
      zoom: 1,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = people
      .filter((person) => person.latest?.latitude != null && person.latest?.longitude != null)
      .map((person) => {
        const marker = new Marker({ color: person.id === selectedPersonId ? '#dc2626' : '#2563eb' })
          .setLngLat([person.latest!.longitude!, person.latest!.latitude!])
          .addTo(map);
        marker.getElement().addEventListener('click', () => onSelectPerson(person.id));
        return marker;
      });
  }, [people, selectedPersonId, onSelectPerson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const coordinates = trail
      .filter((point) => point.latitude != null && point.longitude != null)
      .map((point) => [point.longitude as number, point.latitude as number]);

    const geojson = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    };

    const source = map.getSource(TRAIL_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else if (coordinates.length > 0) {
      map.addSource(TRAIL_SOURCE_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: TRAIL_LAYER_ID,
        type: 'line',
        source: TRAIL_SOURCE_ID,
        paint: { 'line-color': '#dc2626', 'line-width': 3 },
      });
    }
  }, [trail]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';

export function DashboardPage() {
  const { data: people } = usePeople();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  return (
    <div className="flex h-screen">
      <PeopleSidebar
        people={people ?? []}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
      />
      <div className="flex-1">
        <MapView
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          trail={[]}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/MapView.tsx && git commit -m "Add MapView with per-person markers" -q && git push -q
git add react-frontend/src/components/MapView.test.tsx && git commit -m "Add MapView tests" -q && git push -q
git add react-frontend/src/pages/DashboardPage.test.tsx && git commit -m "Add DashboardPage integration test" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire MapView into DashboardPage" -q && git push -q
```

---

## Task 6: Location history trail + timeline list

**Files:**
- Create: `react-frontend/src/hooks/usePersonLocations.ts`
- Create: `react-frontend/src/hooks/usePersonLocations.test.tsx`
- Create: `react-frontend/src/components/LocationHistoryList.tsx`
- Modify: `react-frontend/src/components/MapView.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `fetchPersonLocations(personId)` (Task 2), `MapView` (Task 5, `trail` prop already exists).
- Produces: `usePersonLocations(personId)`, `LocationHistoryList({ locations })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// react-frontend/src/hooks/usePersonLocations.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { usePersonLocations } from './usePersonLocations';

describe('usePersonLocations', () => {
  it('loads history for the given person id', async () => {
    server.use(
      http.get('/api/people/1/locations', () =>
        HttpResponse.json([{ latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' }]),
      ),
    );

    const { result } = renderHook(() => usePersonLocations(1), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('does not fetch when personId is null', () => {
    const { result } = renderHook(() => usePersonLocations(null), { wrapper: TestQueryProvider });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
```

Append to `react-frontend/src/components/MapView.test.tsx` (inside the existing `describe('MapView', ...)` block):

```tsx
  it('adds a trail source when trail points are provided', () => {
    render(
      <MapView
        people={people}
        selectedPersonId={1}
        onSelectPerson={vi.fn()}
        trail={[
          { latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' },
          { latitude: 37.34, longitude: -122.1, capturedAt: '2026-07-06T13:00:00Z' },
        ]}
      />,
    );

    expect(mapInstance.addSource).toHaveBeenCalledWith(
      'person-trail',
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({
          geometry: expect.objectContaining({
            coordinates: [
              [-122.0, 37.33],
              [-122.1, 37.34],
            ],
          }),
        }),
      }),
    );
  });
```

Append to `react-frontend/src/pages/DashboardPage.test.tsx` (inside the existing `describe('DashboardPage', ...)` block):

```tsx
  it('shows the location history for the selected person', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
      http.get('/api/people/1/locations', () =>
        HttpResponse.json([{ latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' }]),
      ),
    );

    render(<DashboardPage />, { wrapper: TestQueryProvider });

    (await screen.findByText('Jane Doe')).click();

    expect(await screen.findByText(new Date('2026-07-06T12:00:00Z').toLocaleString())).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `usePersonLocations`/`LocationHistoryList` don't exist, trail source assertions fail.

- [ ] **Step 3: Implement**

```ts
// react-frontend/src/hooks/usePersonLocations.ts
import { useQuery } from '@tanstack/react-query';
import { fetchPersonLocations } from '../api/client';

export function usePersonLocations(personId: number | null) {
  return useQuery({
    queryKey: ['personLocations', personId],
    queryFn: () => fetchPersonLocations(personId as number),
    enabled: personId !== null,
  });
}
```

```tsx
// react-frontend/src/components/LocationHistoryList.tsx
import type { PersonLocationDto } from '../api/types';

export function LocationHistoryList({ locations }: { locations: PersonLocationDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l p-2">
      {locations.map((location, index) => (
        <li key={`${location.capturedAt}-${index}`} className="border-b py-2 text-sm">
          {new Date(location.capturedAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';

export function DashboardPage() {
  const { data: people } = usePeople();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex h-screen">
      <PeopleSidebar
        people={people ?? []}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
      />
      <div className="flex-1">
        <MapView
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          trail={locations ?? []}
        />
      </div>
      {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/hooks/usePersonLocations.ts && git commit -m "Add usePersonLocations hook" -q && git push -q
git add react-frontend/src/hooks/usePersonLocations.test.tsx && git commit -m "Add usePersonLocations tests" -q && git push -q
git add react-frontend/src/components/LocationHistoryList.tsx && git commit -m "Add LocationHistoryList component" -q && git push -q
git add react-frontend/src/components/MapView.test.tsx && git commit -m "Add MapView trail source test" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire location history trail into DashboardPage" -q && git push -q
git add react-frontend/src/pages/DashboardPage.test.tsx && git commit -m "Add DashboardPage history test" -q && git push -q
```

---

## Task 7: Alerts panel and new-alert banner

**Files:**
- Create: `react-frontend/src/hooks/useAlerts.ts`
- Create: `react-frontend/src/hooks/useAlerts.test.tsx`
- Create: `react-frontend/src/components/AlertsPanel.tsx`
- Create: `react-frontend/src/components/AlertBanner.tsx`
- Create: `react-frontend/src/components/AlertBanner.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `fetchAlerts()` (Task 2).
- Produces: `useAlerts()`, `AlertsPanel({ alerts })`, `AlertBanner({ alerts })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// react-frontend/src/hooks/useAlerts.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { useAlerts } from './useAlerts';

describe('useAlerts', () => {
  it('loads alerts from GET /api/alerts', async () => {
    server.use(
      http.get('/api/alerts', () =>
        HttpResponse.json([
          { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'stale', triggeredAt: '2026-07-06T12:00:00Z' },
        ]),
      ),
    );

    const { result } = renderHook(() => useAlerts(), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });
});
```

```tsx
// react-frontend/src/components/AlertBanner.test.tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertBanner } from './AlertBanner';

const alerts = [
  { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'Jane is stale', triggeredAt: '2026-07-06T12:00:00Z' },
];

describe('AlertBanner', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('shows a banner for an alert id not yet seen', () => {
    render(<AlertBanner alerts={alerts} />);

    expect(screen.getByText(/Jane is stale/)).toBeInTheDocument();
  });

  it('hides the banner after dismiss and does not show it again for the same id', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AlertBanner alerts={alerts} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    rerender(<AlertBanner alerts={alerts} />);

    expect(screen.queryByText(/Jane is stale/)).not.toBeInTheDocument();
  });
});
```

Append to `react-frontend/src/pages/DashboardPage.test.tsx` (inside the existing `describe('DashboardPage', ...)` block):

```tsx
  it('shows the alert banner for a new alert', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([])),
      http.get('/api/alerts', () =>
        HttpResponse.json([
          { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'Jane is stale', triggeredAt: '2026-07-06T12:00:00Z' },
        ]),
      ),
    );

    render(<DashboardPage />, { wrapper: TestQueryProvider });

    expect(await screen.findByText(/Jane is stale/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `useAlerts`/`AlertsPanel`/`AlertBanner` don't exist yet.

- [ ] **Step 3: Implement**

```ts
// react-frontend/src/hooks/useAlerts.ts
import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '../api/client';

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 30_000,
  });
}
```

```tsx
// react-frontend/src/components/AlertsPanel.tsx
import type { AlertEventDto } from '../api/types';

export function AlertsPanel({ alerts }: { alerts: AlertEventDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l p-2">
      {alerts.map((alert) => (
        <li key={alert.id} className="border-b py-2 text-sm">
          <div className="font-medium">{alert.type}</div>
          <div>{alert.message}</div>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// react-frontend/src/components/AlertBanner.tsx
import { useEffect, useState } from 'react';
import type { AlertEventDto } from '../api/types';

const LAST_SEEN_KEY = 'findmy.lastSeenAlertId';

function getLastSeenId(): number {
  const stored = localStorage.getItem(LAST_SEEN_KEY);
  return stored ? Number(stored) : 0;
}

export function AlertBanner({ alerts }: { alerts: AlertEventDto[] }) {
  const [dismissed, setDismissed] = useState(false);
  const newestId = alerts.length > 0 ? Math.max(...alerts.map((alert) => alert.id)) : 0;
  const hasNewAlert = !dismissed && newestId > getLastSeenId();

  useEffect(() => {
    if (dismissed && newestId > 0) {
      localStorage.setItem(LAST_SEEN_KEY, String(newestId));
    }
  }, [dismissed, newestId]);

  if (!hasNewAlert) return null;

  return (
    <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-amber-900">
      <span>New alert: {alerts.find((alert) => alert.id === newestId)?.message}</span>
      <button type="button" onClick={() => setDismissed(true)} className="font-semibold">
        Dismiss
      </button>
    </div>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { AlertsPanel } from '../components/AlertsPanel';
import { AlertBanner } from '../components/AlertBanner';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex h-screen flex-col">
      <AlertBanner alerts={alerts ?? []} />
      <div className="flex flex-1">
        <PeopleSidebar
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
        />
        <div className="flex-1">
          <MapView
            people={people ?? []}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            trail={locations ?? []}
          />
        </div>
        {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
        <AlertsPanel alerts={alerts ?? []} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/hooks/useAlerts.ts && git commit -m "Add useAlerts hook" -q && git push -q
git add react-frontend/src/hooks/useAlerts.test.tsx && git commit -m "Add useAlerts tests" -q && git push -q
git add react-frontend/src/components/AlertsPanel.tsx && git commit -m "Add AlertsPanel component" -q && git push -q
git add react-frontend/src/components/AlertBanner.tsx && git commit -m "Add AlertBanner component" -q && git push -q
git add react-frontend/src/components/AlertBanner.test.tsx && git commit -m "Add AlertBanner tests" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire alerts panel and banner into DashboardPage" -q && git push -q
git add react-frontend/src/pages/DashboardPage.test.tsx && git commit -m "Add DashboardPage alert banner test" -q && git push -q
```

---

## Task 8: Settings page — Find My account registration + 2FA

**Files:**
- Create: `react-frontend/src/components/AccountSettingsForm.tsx`
- Create: `react-frontend/src/components/AccountSettingsForm.test.tsx`
- Modify: `react-frontend/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `registerAccount(request)`, `submitTwoFactorCode(appleId, code)` (Task 2).
- Produces: `AccountSettingsForm` — terminal component for the plan, nothing later depends on it.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/AccountSettingsForm.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { AccountSettingsForm } from './AccountSettingsForm';

describe('AccountSettingsForm', () => {
  it('walks through register -> 2fa required -> active', async () => {
    server.use(
      http.post('/api/accounts', () => HttpResponse.json({ status: '2fa_required' })),
      http.post('/api/accounts/a%40b.com/2fa', () => HttpResponse.json({ status: 'active' })),
    );

    const user = userEvent.setup();
    render(<AccountSettingsForm />, { wrapper: TestQueryProvider });

    await user.type(screen.getByLabelText('Apple ID'), 'a@b.com');
    await user.type(screen.getByLabelText('Apple ID password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    await user.type(await screen.findByLabelText('2FA code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Submit code' }));

    expect(await screen.findByText('Account active.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `AccountSettingsForm` doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/AccountSettingsForm.tsx
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { registerAccount, submitTwoFactorCode } from '../api/client';

export function AccountSettingsForm() {
  const [appleId, setAppleId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'active' | '2fa_required'>('idle');

  const registerMutation = useMutation({
    mutationFn: () => registerAccount({ appleId, password }),
    onSuccess: (response) => setStatus(response.status),
  });

  const twoFactorMutation = useMutation({
    mutationFn: () => submitTwoFactorCode(appleId, code),
    onSuccess: (response) => setStatus(response.status),
  });

  function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    registerMutation.mutate();
  }

  function handleTwoFactorSubmit(event: FormEvent) {
    event.preventDefault();
    twoFactorMutation.mutate();
  }

  if (status === '2fa_required') {
    return (
      <form onSubmit={handleTwoFactorSubmit} className="flex w-80 flex-col gap-4">
        <p>Enter the 2FA code sent to your Apple devices.</p>
        <input
          aria-label="2FA code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">
          Submit code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="flex w-80 flex-col gap-4">
      <input
        aria-label="Apple ID"
        value={appleId}
        onChange={(e) => setAppleId(e.target.value)}
        className="rounded border px-3 py-2"
        placeholder="Apple ID"
      />
      <input
        aria-label="Apple ID password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border px-3 py-2"
        placeholder="Password"
      />
      <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">
        Add account
      </button>
      {status === 'active' && <p className="text-green-700">Account active.</p>}
    </form>
  );
}
```

```tsx
// react-frontend/src/pages/SettingsPage.tsx
import { AccountSettingsForm } from '../components/AccountSettingsForm';

export function SettingsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Find My Account</h1>
        <AccountSettingsForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/AccountSettingsForm.tsx && git commit -m "Add AccountSettingsForm component" -q && git push -q
git add react-frontend/src/components/AccountSettingsForm.test.tsx && git commit -m "Add AccountSettingsForm tests" -q && git push -q
git add react-frontend/src/pages/SettingsPage.tsx && git commit -m "Wire AccountSettingsForm into SettingsPage" -q && git push -q
```

---

## Task 9: Dockerize + docker-compose wiring

**Files:**
- Create: `react-frontend/Dockerfile`
- Create: `react-frontend/nginx.conf`
- Create: `react-frontend/.dockerignore`
- Modify: `docker-compose.yml` (repo root — add `react-frontend` service)

**Interfaces:**
- Produces: a container serving the built SPA on port 80, reverse-proxying `/api/*` to `spring-bff:8080` — this is the final piece; nothing later depends on it.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# react-frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 2: Write the nginx config**

```nginx
# react-frontend/nginx.conf
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://spring-bff:8080;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
    }
}
```

- [ ] **Step 3: Write the dockerignore**

```
# react-frontend/.dockerignore
node_modules
dist
```

- [ ] **Step 4: Wire the service into docker-compose.yml**

Add this service to the root `docker-compose.yml`, alongside `python-findmy-service`, `postgres`, and `spring-bff`:

```yaml
  react-frontend:
    build: ./react-frontend
    ports:
      - "127.0.0.1:3000:80"
    depends_on:
      - spring-bff
```

- [ ] **Step 5: Smoke test**

Run: `docker compose up --build react-frontend spring-bff postgres python-findmy-service`
Then: `curl -i http://localhost:3000/` — expect `200` with HTML containing `<title>Find My Dashboard</title>`.
Then: `curl -i http://localhost:3000/api/people` — expect `401` (proves the nginx proxy is reaching spring-bff, which then rejects the unauthenticated request — spring-bff's own auth, not nginx's).

- [ ] **Step 6: Commit**

```bash
git add react-frontend/Dockerfile && git commit -m "Add Dockerfile for react-frontend" -q && git push -q
git add react-frontend/nginx.conf && git commit -m "Add nginx config with API reverse proxy" -q && git push -q
git add react-frontend/.dockerignore && git commit -m "Add react-frontend dockerignore" -q && git push -q
git add docker-compose.yml && git commit -m "Wire react-frontend service into docker-compose" -q && git push -q
```

---

## Done criteria

react-frontend is complete when:
1. `cd react-frontend && npm run test` passes every task's tests.
2. `npm run build` produces a `dist/` bundle with no TypeScript errors.
3. `docker compose up --build` serves the dashboard at `http://localhost:3000`, an unauthenticated visit redirects to `/login`, and after logging in with the real dashboard credentials the map, sidebar, alerts panel, and settings page all work end-to-end against the real spring-bff + python-findmy-service + a real Apple ID (blocked on Task 1 of python-findmy-service — the live spike — still pending on the user).
