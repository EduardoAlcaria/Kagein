import type { PersonSummaryDto } from '../api/types';
import { relativeTime } from '../lib/time';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';

const LIVE_WINDOW_MS = 5 * 60_000;

function isLive(person: PersonSummaryDto): boolean {
  return person.latest != null && Date.now() - new Date(person.latest.capturedAt).getTime() < LIVE_WINDOW_MS;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface PeopleSidebarProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
}

export function PeopleSidebar({ people, selectedPersonId, onSelectPerson }: PeopleSidebarProps) {
  return (
    <ul className="divide-y divide-border">
      {people.map((person) => {
        const selected = person.id === selectedPersonId;
        const live = isLive(person);
        return (
          <li key={person.id}>
            <button
              type="button"
              onClick={() => onSelectPerson(person.id)}
              className={`relative flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/20 ${
                selected ? 'bg-muted/30' : ''
              }`}
            >
              {selected && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-primary" />
              )}
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                  {initials(person.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {person.latest ? relativeTime(person.latest.capturedAt) : 'no location yet'}
                </p>
              </div>
              {person.latest == null ? (
                <Badge variant="muted">NO SIGNAL</Badge>
              ) : live ? (
                <span className="flex items-center gap-1.5">
                  <span className="live-dot" />
                  <Badge variant="live">LIVE</Badge>
                </span>
              ) : (
                <Badge variant="stale">STALE</Badge>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
