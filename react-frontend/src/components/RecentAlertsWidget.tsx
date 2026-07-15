import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { AlertEventDto } from '../api/types';

export function RecentAlertsWidget({ alerts }: { alerts: AlertEventDto[] }) {
  const recent = alerts.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm">Recent alerts</CardTitle>
        <Link to="/alerts" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((alert) => (
              <li key={alert.id} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {alert.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
