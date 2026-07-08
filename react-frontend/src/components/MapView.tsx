import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const TRAIL_SOURCE_ID = 'person-trail';
const TRAIL_LAYER_ID = 'person-trail-line';

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
        const marker = new Marker({ color: person.id === selectedPersonId ? '#dc2626' : '#2563eb' })
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
        paint: { 'line-color': '#dc2626', 'line-width': 3 },
      });
    }
  }, [trail]);

  return <div ref={containerRef} className="h-full w-full" />;
}
