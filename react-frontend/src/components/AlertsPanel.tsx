import type { AlertEventDto } from '../api/types';

export function AlertsPanel({ alerts }: { alerts: AlertEventDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l border-border bg-card p-2 text-card-foreground">
      {alerts.map((alert) => (
        <li key={alert.id} className="border-b border-border py-2 text-sm">
          <div className="font-medium">{alert.type}</div>
          <div>{alert.message}</div>
        </li>
      ))}
    </ul>
  );
}
