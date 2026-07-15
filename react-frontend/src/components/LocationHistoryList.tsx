import type { PersonLocationDto } from '../api/types';

function coordinates(location: PersonLocationDto): string {
  if (location.latitude == null || location.longitude == null) return 'no fix';
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

export function LocationHistoryList({ locations }: { locations: PersonLocationDto[] }) {
  return (
    <ul className="divide-y divide-border">
      {locations.map((location, index) => (
        <li
          key={`${location.capturedAt}-${index}`}
          className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-muted/20"
        >
          <span className="font-mono text-xs text-foreground">
            {new Date(location.capturedAt).toLocaleString()}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{coordinates(location)}</span>
        </li>
      ))}
    </ul>
  );
}
