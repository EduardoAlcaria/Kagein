import { useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { usePeople } from '../hooks/usePeople';
import { PredictionTotalizers } from '../components/PredictionTotalizers';
import { EmptyState, PanelCard } from '../components/PanelCard';

export function PredictionPage() {
  const [searchParams] = useSearchParams();
  const personId = searchParams.get('personId');
  const { data: people } = usePeople();
  const person = people?.find((p) => String(p.id) === personId);

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 p-4 lg:grid-cols-2 lg:p-6">
      <PanelCard title={person ? `Prediction · ${person.name}` : 'Prediction'}>
        <EmptyState
          icon={Sparkles}
          message={person ? `Coming soon for ${person.name}.` : 'Coming soon.'}
        />
      </PanelCard>
      <PredictionTotalizers people={people ?? []} />
    </div>
  );
}
