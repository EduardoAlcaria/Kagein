import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { MapPanel } from './MapPanel';

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

function renderPanel() {
  return render(
    <TestQueryProvider>
      <MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />
    </TestQueryProvider>,
  );
}

describe('MapPanel', () => {
  it('toggles fullscreen', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
  });

  it('searches an address via Nominatim and lists results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
        ),
      ),
    );

    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Eiffel Tower, Paris')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('saves a searched result via POST /api/points', async () => {
    let posted: unknown = null;
    server.use(
      http.get('https://nominatim.openstreetmap.org/search', () =>
        HttpResponse.json([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
      ),
      http.post('/api/points', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ id: 1, label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 });
      }),
      http.get('/api/points', () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByText('Eiffel Tower, Paris'));
    await user.click(screen.getByRole('button', { name: 'Add as alert point' }));

    await waitFor(() =>
      expect(posted).toEqual({ label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 }),
    );
  });

  it('shows a confirmation message after adding a point', async () => {
    server.use(
      http.get('https://nominatim.openstreetmap.org/search', () =>
        HttpResponse.json([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
      ),
      http.post('/api/points', () =>
        HttpResponse.json({ id: 1, label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 }),
      ),
      http.get('/api/points', () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByText('Eiffel Tower, Paris'));
    await user.click(screen.getByRole('button', { name: 'Add as alert point' }));

    expect(await screen.findByText('Saved Eiffel Tower, Paris.')).toBeInTheDocument();
  });

  it('shows an error message when the search request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Search failed. Try again.')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
