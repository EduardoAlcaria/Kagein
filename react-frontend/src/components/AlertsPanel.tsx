import type { AlertEventDto } from '../api/types';

export function AlertsPanel({ alerts }: { alerts: AlertEventDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-2 text-neutral-100">
      {alerts.map((alert) => (
        <li key={alert.id} className="border-b border-neutral-800 py-2 text-sm">
          <div className="font-medium">{alert.type}</div>
          <div>{alert.message}</div>
        </li>
      ))}
    </ul>
  );
}
