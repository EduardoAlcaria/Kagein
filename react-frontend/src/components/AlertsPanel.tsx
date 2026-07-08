import type { AlertEventDto } from '../api/types';

export function AlertsPanel({ alerts }: { alerts: AlertEventDto[] }) {
  return (
    <ul className="w-72 overflow-y-auto border-l p-2">
      {alerts.map((alert) => (
        <li key={alert.id} className="border-b py-2 text-sm">
          <div className="font-medium">{alert.type}</div>
          <div>{alert.message}</div>
        </li>
      ))}
    </ul>
  );
}
