import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { PersonSummaryDto } from '../api/types';

function mockProbability(seed: number): number {
  return ((seed * 37) % 60) + 20;
}

export function PredictionTotalizers({ people }: { people: PersonSummaryDto[] }) {
  const navigate = useNavigate();

  if (people.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {people.map((person) => (
        <Card
          key={person.id}
          className="cursor-pointer"
          onClick={() => navigate(`/prediction?personId=${person.id}`)}
        >
          <CardHeader>
            <CardTitle className="text-sm">{person.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{mockProbability(person.id)}%</p>
            <p className="text-xs text-muted-foreground">chance at usual location now</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
