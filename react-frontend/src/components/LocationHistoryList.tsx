import type { PersonLocationDto } from '../api/types';

export function LocationHistoryList({ locations }: { locations: PersonLocationDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-2 text-neutral-100">
      {locations.map((location, index) => (
        <li key={`${location.capturedAt}-${index}`} className="border-b border-neutral-800 py-2 text-sm">
          {new Date(location.capturedAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
