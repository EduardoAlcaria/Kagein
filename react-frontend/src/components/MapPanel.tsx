import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapView } from './MapView';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SavedPoint {
  label: string;
  latitude: number;
  longitude: number;
}

const SAVED_POINTS_KEY = 'findmy.savedPoints';

function loadSavedPoints(): SavedPoint[] {
  const stored = localStorage.getItem(SAVED_POINTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveSavedPoints(points: SavedPoint[]): void {
  localStorage.setItem(SAVED_POINTS_KEY, JSON.stringify(points));
}

interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail }: MapPanelProps) {
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
    const points = loadSavedPoints();
    points.push({
      label: selectedResult.display_name,
      latitude: Number(selectedResult.lat),
      longitude: Number(selectedResult.lon),
    });
    saveSavedPoints(points);
    setSavedMessage(`Saved ${selectedResult.display_name}.`);
    setResults([]);
    setSelectedResult(null);
    setQuery('');
  }

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative h-full w-full'}>
      <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-2">
        <div className="flex gap-2">
          <Input
            aria-label="Search address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address"
            className="w-64"
          />
          <Button type="button" onClick={handleSearch}>
            Search
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsFullscreen((v) => !v)}>
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
        </div>
        {searchError && <p className="text-sm text-destructive">{searchError}</p>}
        {results.length > 0 && (
          <ul className="max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {results.map((result) => (
              <li key={result.display_name}>
                <button
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  className="w-full rounded px-2 py-1 text-left text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedResult && (
          <Button type="button" onClick={handleAddPoint}>
            Add as alert point
          </Button>
        )}
        {savedMessage && <p className="text-sm text-primary">{savedMessage}</p>}
      </div>
      <MapView
        people={people}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        trail={trail}
      />
    </div>
  );
}
