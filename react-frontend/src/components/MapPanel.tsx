import { useState } from 'react';
import { Button } from './ui/button';
import { MapView } from './MapView';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail }: MapPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative h-full w-full'}>
      <div className="absolute left-2 top-2 z-10">
        <Button type="button" variant="outline" onClick={() => setIsFullscreen((v) => !v)}>
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
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
