import { Bell, TriangleAlert } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { relativeTime } from '../lib/time';
import { EmptyState, PanelCard } from '../components/PanelCard';
import { Badge } from '../components/ui/badge';

export function AlertsPage() {
  const { data: alerts } = useAlerts();
  const allAlerts = alerts ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <PanelCard
        title="All alerts"
        action={
          <span className="font-mono text-xs text-muted-foreground">{allAlerts.length} total</span>
        }
      >
        {allAlerts.length === 0 ? (
          <EmptyState icon={Bell} message="No alerts yet." />
        ) : (
          <ul className="divide-y divide-border">
            {allAlerts.map((alert) => (
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
                    {new Date(alert.triggeredAt).toLocaleString()} · {relativeTime(alert.triggeredAt)}
                  </p>
                </div>
                <Badge variant="muted">{alert.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
}
