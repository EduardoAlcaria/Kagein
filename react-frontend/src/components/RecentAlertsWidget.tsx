import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { AlertEventDto } from '../api/types';

export function RecentAlertsWidget({ alerts }: { alerts: AlertEventDto[] }) {
  const recent = alerts.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Recent alerts</CardTitle>
        <Link to="/alerts" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((alert) => (
              <li key={alert.id} className="text-sm">
                {alert.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
