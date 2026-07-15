import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
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
    <div className="flex items-center justify-between gap-4 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <span className="flex min-w-0 items-center gap-2.5">
        <AlertCircle size={14} className="shrink-0" />
        <span className="truncate">New alert: {alerts.find((alert) => alert.id === newestId)?.message}</span>
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
