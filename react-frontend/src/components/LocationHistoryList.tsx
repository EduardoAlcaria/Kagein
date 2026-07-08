import type { PersonLocationDto } from '../api/types';

export function LocationHistoryList({ locations }: { locations: PersonLocationDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l p-2">
      {locations.map((location, index) => (
        <li key={`${location.capturedAt}-${index}`} className="border-b py-2 text-sm">
          {new Date(location.capturedAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
