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
});
