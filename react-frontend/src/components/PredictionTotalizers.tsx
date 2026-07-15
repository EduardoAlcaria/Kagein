import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { PersonSummaryDto } from '../api/types';
import { PanelCard } from './PanelCard';

function mockProbability(seed: number): number {
  return ((seed * 37) % 60) + 20;
}

export function PredictionTotalizers({ people }: { people: PersonSummaryDto[] }) {
  const location = useLocation();

  if (people.length === 0) return null;

  return (
    <PanelCard
      title="Chance at usual location"
      style={{ animationDelay: '150ms' }}
      action={
        location.pathname === '/prediction' ? undefined : (
          <Link to="/prediction" className="text-xs text-primary hover:underline">
            Open <span aria-hidden="true">→</span>
          </Link>
        )
      }
    >
      <ul className="divide-y divide-border">
        {people.map((person) => {
          const probability = mockProbability(person.id);
          return (
            <li key={person.id}>
              <Link
                to={`/prediction?personId=${person.id}`}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${probability}%` }} />
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                  {probability}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </PanelCard>
  );
}
