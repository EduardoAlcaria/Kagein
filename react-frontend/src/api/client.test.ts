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
