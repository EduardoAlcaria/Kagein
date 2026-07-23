import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { createTestQueryClient } from '../test/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthContext';
import { DashboardPage } from './DashboardPage';

function renderDashboard() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    remove: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(() => undefined),
    fitBounds: vi.fn(),
  })),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getElement: () => document.createElement('div'),
  })),
}));

describe('DashboardPage', () => {
  it('renders the share-my-location toggle', async () => {
    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Share my location' })).toBeInTheDocument();
  });

  it('renders the people sidebar from GET /api/people', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
    );

    renderDashboard();

    expect(await screen.findByRole('button', { name: /Jane Doe/ })).toBeInTheDocument();
  });

  it('shows the location history for the selected person', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
      http.get('/api/people/1/locations', () =>
        HttpResponse.json([{ latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' }]),
      ),
    );

    renderDashboard();

    (await screen.findByRole('button', { name: /Jane Doe/ })).click();

    expect(await screen.findByText(new Date('2026-07-06T12:00:00Z').toLocaleString())).toBeInTheDocument();
  });
});
