import type { PersonSummaryDto } from '../api/types';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 5 * 60_000;
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
            <div className="flex items-center gap-2">
              <span
                className={
                  person.latest && isRecent(person.latest.capturedAt)
                    ? 'beacon-dot h-2 w-2 shrink-0'
                    : 'h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40'
                }
              />
              <span className="font-display font-medium">{person.name}</span>
            </div>
            <div className="pl-4 font-mono text-xs text-muted-foreground">
              {person.latest ? relativeTime(person.latest.capturedAt) : 'no location yet'}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
