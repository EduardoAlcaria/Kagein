import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapView, type ZoneRenderable } from './MapView';
import { useCreatePoint } from '../hooks/usePoints';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
  zones?: ZoneRenderable[];
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail, zones }: MapPanelProps) {
  const createPoint = useCreatePoint();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<NominatimResult | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setResults([]);
    setSearchError(null);
    setSavedMessage(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
      );
      const data: NominatimResult[] = await response.json();
      setResults(data);
    } catch {
      setSearchError('Search failed. Try again.');
    }
  }

  function handleAddPoint() {
    if (!selectedResult) return;
    createPoint.mutate({
      label: selectedResult.display_name,
      latitude: Number(selectedResult.lat),
      longitude: Number(selectedResult.lon),
    });
    setSavedMessage(`Saved ${selectedResult.display_name}.`);
    setResults([]);
    setSelectedResult(null);
    setQuery('');
  }

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative h-full w-full'}>
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border bg-card/95 p-1.5 shadow-lg backdrop-blur">
          <Input
            aria-label="Search address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address"
            className="h-8 w-56 border-0 bg-muted/60 text-sm shadow-none focus-visible:ring-1"
          />
          <Button type="button" size="sm" onClick={handleSearch}>
            Search
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setIsFullscreen((v) => !v)}>
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
        </div>
        {searchError && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {searchError}
          </p>
        )}
        {results.length > 0 && (
          <ul className="max-h-48 w-72 divide-y divide-border overflow-y-auto rounded-lg border bg-card/95 shadow-lg backdrop-blur">
            {results.map((result) => (
              <li key={result.display_name}>
                <button
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  className="w-full px-3 py-2 text-left text-xs text-card-foreground transition-colors hover:bg-muted/40"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedResult && (
          <Button type="button" size="sm" onClick={handleAddPoint}>
            Add as alert point
          </Button>
        )}
        {savedMessage && (
          <p className="rounded-md border border-live/20 bg-live/10 px-2.5 py-1.5 text-xs text-live">
            {savedMessage}
          </p>
        )}
      </div>
      <MapView
        people={people}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        trail={trail}
        zones={zones}
      />
    </div>
  );
}
