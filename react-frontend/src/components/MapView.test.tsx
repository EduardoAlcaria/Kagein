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
  fitBounds: vi.fn(),
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
    mapInstance.fitBounds.mockClear();
    mapInstance.addSource.mockClear();
    mapInstance.addLayer.mockClear();
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

  it('frames the people with known locations', () => {
    const spread = [
      { id: 1, name: 'A', latest: { latitude: 10, longitude: 20, capturedAt: '2026-07-06T12:00:00Z' } },
      { id: 2, name: 'B', latest: { latitude: -5, longitude: 40, capturedAt: '2026-07-06T12:00:00Z' } },
    ];

    render(<MapView people={spread} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    expect(mapInstance.fitBounds).toHaveBeenCalledWith(
      [
        [20, -5],
        [40, 10],
      ],
      expect.objectContaining({ maxZoom: 15 }),
    );
  });

  it('does not re-frame when a refetch returns the same selection', () => {
    const { rerender } = render(
      <MapView people={people} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />,
    );
    expect(mapInstance.fitBounds).toHaveBeenCalledTimes(1);

    // A poll hands back an equal-but-new array; the map must stay where it is.
    rerender(<MapView people={[...people]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    expect(mapInstance.fitBounds).toHaveBeenCalledTimes(1);
  });

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

  it('adds a fill layer for each zone', () => {
    render(
      <MapView
        people={[]}
        selectedPersonId={null}
        onSelectPerson={vi.fn()}
        trail={[]}
        zones={[
          { id: 1, shape: 'CIRCLE', color: '#ef4444', center: [-23.56, -46.65], radiusMeters: 50, vertices: null },
        ]}
      />,
    );

    expect(mapInstance.addSource).toHaveBeenCalledWith('zone-1', expect.objectContaining({ type: 'geojson' }));
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'zone-1-fill', type: 'fill' }),
    );
  });
});
