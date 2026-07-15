import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('MapPanel', () => {
  it('toggles fullscreen', async () => {
    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

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
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Eiffel Tower, Paris')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('selects a search result and saves it as an alert point', async () => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
        ),
      ),
    );

    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByText('Eiffel Tower, Paris'));
    await user.click(screen.getByRole('button', { name: 'Add as alert point' }));

    const saved = JSON.parse(localStorage.getItem('findmy.savedPoints') ?? '[]');
    expect(saved).toEqual([{ label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 }]);

    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows a confirmation message after adding a point', async () => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
        ),
      ),
    );

    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByText('Eiffel Tower, Paris'));
    await user.click(screen.getByRole('button', { name: 'Add as alert point' }));

    expect(await screen.findByText('Saved Eiffel Tower, Paris.')).toBeInTheDocument();

    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows an error message when the search request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Search failed. Try again.')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
