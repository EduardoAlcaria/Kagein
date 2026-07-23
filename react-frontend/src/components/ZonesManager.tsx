import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ZoneEditor, type EditorGeometry } from './ZoneEditor';
import { usePoints, useCreatePoint, useDeletePoint } from '../hooks/usePoints';
import { useZones, useCreateZone, useDeleteZone } from '../hooks/useZones';
import type { ZoneTrigger } from '../api/types';

const TRIGGERS: ZoneTrigger[] = ['ENTER', 'LEAVE', 'INSIDE'];

export function ZonesManager() {
  const { data: points } = usePoints();
  const { data: zones } = useZones();
  const createPoint = useCreatePoint();
  const deletePoint = useDeletePoint();
  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();

  const [label, setLabel] = useState('');
  const [geometry, setGeometry] = useState<EditorGeometry | null>(null);
  const [trigger, setTrigger] = useState<ZoneTrigger>('ENTER');
  const [color, setColor] = useState('#ef4444');
  const [alarmMessage, setAlarmMessage] = useState('');

  async function handleSave() {
    if (!geometry || !label.trim() || !alarmMessage.trim()) return;
    const center = geometry.shape === 'CIRCLE' ? geometry.center : geometry.vertices[0];
    const point = await createPoint.mutateAsync({
      label,
      latitude: center[0],
      longitude: center[1],
    });
    if (geometry.shape === 'CIRCLE') {
      await createZone.mutateAsync({
        poiId: point.id, shape: 'CIRCLE', radiusMeters: geometry.radiusMeters,
        trigger, color, alarmMessage,
      });
    } else {
      await createZone.mutateAsync({
        poiId: point.id, shape: 'POLYGON', vertices: JSON.stringify(geometry.vertices),
        trigger, color, alarmMessage,
      });
    }
    setLabel('');
    setGeometry(null);
    setAlarmMessage('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zones & alert points</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {(points ?? []).map((point) => (
            <div key={point.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{point.label}</span>
                <Button type="button" variant="outline" onClick={() => deletePoint.mutate(point.id)}>
                  Delete point
                </Button>
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {(zones ?? []).filter((z) => z.poiId === point.id).map((zone) => (
                  <li key={zone.id} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                            style={{ backgroundColor: zone.color }} />
                      {zone.shape} · {zone.trigger} · {zone.alarmMessage}
                    </span>
                    <Button type="button" variant="outline" onClick={() => deleteZone.mutate(zone.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Input aria-label="Point label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Point label" />
          <ZoneEditor onGeometry={setGeometry} />
          {geometry && <p className="text-xs text-muted-foreground">Geometry ready: {geometry.shape}</p>}
          <select
            aria-label="Trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as ZoneTrigger)}
            className="rounded-md border border-input bg-background p-2 text-sm"
          >
            {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input aria-label="Color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#ef4444" />
          <Input aria-label="Alarm message" value={alarmMessage} onChange={(e) => setAlarmMessage(e.target.value)} placeholder="Alarm message" />
          <Button type="button" onClick={handleSave}>Save zone</Button>
        </div>
      </CardContent>
    </Card>
  );
}
