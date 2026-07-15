import type { PersonLocationDto } from '../api/types';

export function LocationHistoryList({ locations }: { locations: PersonLocationDto[] }) {
  return (
    <ul className="divide-y divide-border">
      {locations.map((location, index) => (
        <li key={`${location.capturedAt}-${index}`} className="py-2 text-sm text-card-foreground">
          {new Date(location.capturedAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
