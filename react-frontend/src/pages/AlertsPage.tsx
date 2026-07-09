import { useAlerts } from '../hooks/useAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function AlertsPage() {
  const { data: alerts } = useAlerts();

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {(alerts ?? []).map((alert) => (
              <li key={alert.id} className="border-b border-border py-2 text-sm last:border-b-0">
                <div className="font-medium">{alert.type}</div>
                <div className="text-muted-foreground">{alert.message}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
