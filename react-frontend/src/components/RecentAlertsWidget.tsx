import { Link } from 'react-router-dom';
import { Bell, TriangleAlert } from 'lucide-react';
import type { AlertEventDto } from '../api/types';
import { relativeTime } from '../lib/time';
import { EmptyState, PanelCard } from './PanelCard';
import { Badge } from './ui/badge';

export function RecentAlertsWidget({ alerts }: { alerts: AlertEventDto[] }) {
  const recent = alerts.slice(0, 5);

  return (
    <PanelCard
      title="Recent alerts"
      action={
        <Link to="/alerts" className="text-xs text-primary hover:underline">
          View all <span aria-hidden="true">→</span>
        </Link>
      }
    >
      {recent.length === 0 ? (
        <EmptyState icon={Bell} message="No alerts yet." />
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((alert) => (
            <li
              key={alert.id}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/20"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <TriangleAlert size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{alert.message}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {relativeTime(alert.triggeredAt)}
                </p>
              </div>
              <Badge variant="muted">{alert.type}</Badge>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
