import { useEffect, useState } from 'react';
import type { AlertEventDto } from '../api/types';

const LAST_SEEN_KEY = 'findmy.lastSeenAlertId';

function getLastSeenId(): number {
  const stored = localStorage.getItem(LAST_SEEN_KEY);
  return stored ? Number(stored) : 0;
}

export function AlertBanner({ alerts }: { alerts: AlertEventDto[] }) {
  const [dismissed, setDismissed] = useState(false);
  const newestId = alerts.length > 0 ? Math.max(...alerts.map((alert) => alert.id)) : 0;
  const hasNewAlert = !dismissed && newestId > getLastSeenId();

  useEffect(() => {
    if (dismissed && newestId > 0) {
      localStorage.setItem(LAST_SEEN_KEY, String(newestId));
    }
  }, [dismissed, newestId]);

  if (!hasNewAlert) return null;

  return (
    <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-amber-900">
      <span>New alert: {alerts.find((alert) => alert.id === newestId)?.message}</span>
      <button type="button" onClick={() => setDismissed(true)} className="font-semibold">
        Dismiss
      </button>
    </div>
  );
}
