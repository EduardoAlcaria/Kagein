import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const TRAIL_SOURCE_ID = 'person-trail';
const TRAIL_LAYER_ID = 'person-trail-line';

function isLive(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 5 * 60_000;
}

function createMarkerElement(selected: boolean, live: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = selected ? '18px' : '14px';
  el.style.height = el.style.width;
  el.style.borderRadius = '9999px';
  el.style.cursor = 'pointer';
  el.style.border = selected ? '2px solid oklch(1 0 0)' : '2px solid oklch(1 0 0 / 0.7)';
  el.style.backgroundColor = live ? 'var(--live)' : 'var(--muted-foreground)';
  if (live) {
    el.className = 'marker-live';
  }
  return el;
}

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
  const fitKeyRef = useRef<string | null>(null);

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
        const selected = person.id === selectedPersonId;
        const live = person.latest != null && isLive(person.latest.capturedAt);
        const marker = new Marker({ element: createMarkerElement(selected, live) })
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
        // MapLibre parses paint colors itself, so this can't read the CSS token.
        paint: { 'line-color': '#4f46e5', 'line-width': 3 },
      });
    }
  }, [trail]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const coordinates: [number, number][] =
      selectedPersonId != null && trail.length > 0
        ? trail
            .filter((point) => point.latitude != null && point.longitude != null)
            .map((point) => [point.longitude as number, point.latitude as number])
        : people
            .filter((person) => person.latest?.latitude != null && person.latest?.longitude != null)
            .map((person) => [person.latest!.longitude!, person.latest!.latitude!]);
    if (coordinates.length === 0) return;

    // Re-frame only when the selection (or what we can frame) changes, so a
    // background refetch never yanks the map away from where the user panned.
    const fitKey = `${selectedPersonId ?? 'all'}:${trail.length > 0 ? 'trail' : 'people'}`;
    if (fitKeyRef.current === fitKey) return;
    fitKeyRef.current = fitKey;

    const longitudes = coordinates.map(([lng]) => lng);
    const latitudes = coordinates.map(([, lat]) => lat);
    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 64, maxZoom: 15, duration: 600 },
    );
  }, [people, trail, selectedPersonId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
