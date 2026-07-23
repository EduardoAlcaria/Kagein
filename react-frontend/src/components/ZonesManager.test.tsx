import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { ZonesManager } from './ZonesManager';

describe('ZonesManager', () => {
  it('lists existing points and their zones', async () => {
    server.use(
      http.get('/api/points', () =>
        HttpResponse.json([{ id: 1, label: 'Home', latitude: -23.56, longitude: -46.65 }]),
      ),
      http.get('/api/zones', () =>
        HttpResponse.json([
          { id: 5, poiId: 1, shape: 'CIRCLE', radiusMeters: 50, vertices: null,
            trigger: 'ENTER', color: '#f00', alarmMessage: 'near home' },
        ]),
      ),
    );

    render(
      <TestQueryProvider>
        <ZonesManager />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(await screen.findByText(/near home/)).toBeInTheDocument();
  });
});
