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
