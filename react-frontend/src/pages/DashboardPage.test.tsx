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
