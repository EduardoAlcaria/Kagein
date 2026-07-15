import { useState } from 'react';
import type { AlertEventDto } from '../api/types';

const LAST_SEEN_KEY = 'findmy.lastSeenAlertId';

function getLastSeenId(): number {
  const stored = localStorage.getItem(LAST_SEEN_KEY);
  return stored ? Number(stored) : 0;
}

export function AlertBanner({ alerts }: { alerts: AlertEventDto[] }) {
  const [lastSeenId, setLastSeenId] = useState(getLastSeenId);
  const newestId = alerts.length > 0 ? Math.max(...alerts.map((alert) => alert.id)) : 0;
  const hasNewAlert = newestId > lastSeenId;

  function dismiss() {
    localStorage.setItem(LAST_SEEN_KEY, String(newestId));
    setLastSeenId(newestId);
  }

  if (!hasNewAlert) return null;

  return (
    <div className="flex items-center justify-between gap-4 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
      <span>New alert: {alerts.find((alert) => alert.id === newestId)?.message}</span>
      <button type="button" onClick={dismiss} className="shrink-0 font-semibold underline-offset-2 hover:underline">
        Dismiss
      </button>
    </div>
  );
}
