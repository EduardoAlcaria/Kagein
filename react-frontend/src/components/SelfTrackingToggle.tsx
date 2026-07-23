// react-frontend/src/components/SelfTrackingToggle.tsx
import { Button } from './ui/button';
import type { GeoStatus } from '../hooks/useMyLocation';

interface SelfTrackingToggleProps {
  enabled: boolean;
  status: GeoStatus;
  onToggle: (next: boolean) => void;
}

export function SelfTrackingToggle({ enabled, status, onToggle }: SelfTrackingToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={enabled ? 'default' : 'outline'}
        onClick={() => onToggle(!enabled)}
      >
        {enabled ? 'Stop sharing my location' : 'Share my location'}
      </Button>
      {enabled && status === 'denied' && (
        <span className="text-xs text-destructive">Location permission denied</span>
      )}
    </div>
  );
}
