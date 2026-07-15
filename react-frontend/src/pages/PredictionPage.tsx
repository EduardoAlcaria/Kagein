import { useSearchParams } from 'react-router-dom';
import { usePeople } from '../hooks/usePeople';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function PredictionPage() {
  const [searchParams] = useSearchParams();
  const personId = searchParams.get('personId');
  const { data: people } = usePeople();
  const person = people?.find((p) => String(p.id) === personId);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Previsão</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {person ? `Coming soon for ${person.name}.` : 'Coming soon.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
