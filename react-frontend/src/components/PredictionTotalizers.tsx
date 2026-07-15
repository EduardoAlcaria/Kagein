import { useNavigate } from 'react-router-dom';
import type { PersonSummaryDto } from '../api/types';

function mockProbability(seed: number): number {
  return ((seed * 37) % 60) + 20;
}

export function PredictionTotalizers({ people }: { people: PersonSummaryDto[] }) {
  const navigate = useNavigate();

  if (people.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border/60 bg-background/70 px-3 py-2 backdrop-blur-xl">
      {people.map((person) => (
        <div
          key={person.id}
          onClick={() => navigate(`/prediction?personId=${person.id}`)}
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 transition-colors hover:bg-accent"
        >
          <span className="font-display text-sm font-medium">{person.name}</span>
          <span className="font-mono text-sm font-semibold text-primary">{mockProbability(person.id)}%</span>
        </div>
      ))}
    </div>
  );
}
