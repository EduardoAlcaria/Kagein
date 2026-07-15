import type { PersonSummaryDto } from '../api/types';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

interface PeopleSidebarProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
}

export function PeopleSidebar({ people, selectedPersonId, onSelectPerson }: PeopleSidebarProps) {
  return (
    <ul className="flex flex-col gap-1">
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onSelectPerson(person.id)}
            className={`w-full rounded-lg px-3 py-2 text-left ${
              person.id === selectedPersonId
                ? 'bg-accent text-accent-foreground'
                : 'text-card-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <div className="font-medium">{person.name}</div>
            <div className="text-sm text-muted-foreground">
              {person.latest ? relativeTime(person.latest.capturedAt) : 'no location yet'}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
