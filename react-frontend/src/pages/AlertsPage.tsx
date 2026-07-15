import { useAlerts } from '../hooks/useAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function AlertsPage() {
  const { data: alerts } = useAlerts();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {(alerts ?? []).map((alert) => (
              <li key={alert.id} className="flex items-start gap-3 border-b border-border py-3 text-sm last:border-b-0">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <div>
                  <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{alert.type}</div>
                  <div>{alert.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
