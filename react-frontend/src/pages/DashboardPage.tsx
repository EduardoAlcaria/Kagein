import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock, MapPin, Radio, Users } from 'lucide-react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { useZones } from '../hooks/useZones';
import { usePoints } from '../hooks/usePoints';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapPanel } from '../components/MapPanel';
import type { ZoneRenderable } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { PredictionTotalizers } from '../components/PredictionTotalizers';
import { RecentAlertsWidget } from '../components/RecentAlertsWidget';
import { StatCard } from '../components/StatCard';
import { EmptyState, PanelCard } from '../components/PanelCard';

const LIVE_WINDOW_MS = 5 * 60_000;

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);
  const { data: zones } = useZones();
  const { data: points } = usePoints();

  const zoneRenderables: ZoneRenderable[] = (zones ?? []).flatMap((zone) => {
    const poi = (points ?? []).find((p) => p.id === zone.poiId);
    if (!poi) return [];
    return [{
      id: zone.id,
      shape: zone.shape,
      color: zone.color,
      center: [poi.latitude, poi.longitude] as [number, number],
      radiusMeters: zone.radiusMeters,
      vertices: zone.vertices ? (JSON.parse(zone.vertices) as [number, number][]) : null,
    }];
  });

  const allPeople = people ?? [];
  const allAlerts = alerts ?? [];
  const liveCount = allPeople.filter(
    (person) =>
      person.latest != null && Date.now() - new Date(person.latest.capturedAt).getTime() < LIVE_WINDOW_MS,
  ).length;
  const staleCount = allPeople.length - liveCount;
  const selectedPerson = allPeople.find((person) => person.id === selectedPersonId);

  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          icon={Users}
          label="People tracked"
          value={allPeople.length}
          color="bg-primary/15 text-primary"
        />
        <StatCard
          icon={Radio}
          label="Live now"
          value={liveCount}
          sub="seen in the last 5 min"
          color="bg-live/15 text-live"
        />
        <StatCard
          icon={Clock}
          label="Stale"
          value={staleCount}
          sub="no recent fix"
          color="bg-stale/15 text-stale"
        />
        <StatCard
          icon={Bell}
          label="Alerts"
          value={allAlerts.length}
          color="bg-destructive/15 text-destructive"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard
          title="Live map"
          className="flex flex-col lg:col-span-2"
          contentClassName="flex-1"
          style={{ animationDelay: '100ms' }}
          action={
            selectedPerson ? (
              <span className="font-mono text-xs text-muted-foreground">
                tracking {selectedPerson.name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Select a person to see their trail</span>
            )
          }
        >
          <div className="relative h-full min-h-[420px]">
            <MapPanel
              people={allPeople}
              selectedPersonId={selectedPersonId}
              onSelectPerson={setSelectedPersonId}
              trail={locations ?? []}
              zones={zoneRenderables}
            />
          </div>
        </PanelCard>

        <div className="flex flex-col gap-4">
          <PanelCard
            title="People"
            className="flex flex-1 flex-col"
            contentClassName="flex-1 overflow-y-auto"
            style={{ animationDelay: '150ms' }}
          >
            {allPeople.length === 0 ? (
              <EmptyState
                icon={Users}
                message="No people yet"
                action={
                  <Link to="/settings" className="text-xs text-primary hover:underline">
                    Connect an Apple ID <span aria-hidden="true">→</span>
                  </Link>
                }
              />
            ) : (
              <PeopleSidebar
                people={allPeople}
                selectedPersonId={selectedPersonId}
                onSelectPerson={setSelectedPersonId}
              />
            )}
          </PanelCard>

          {selectedPerson && (
            <PanelCard
              title={`History · ${selectedPerson.name}`}
              contentClassName="max-h-64 overflow-y-auto"
              style={{ animationDelay: '200ms' }}
            >
              {(locations ?? []).length === 0 ? (
                <EmptyState icon={MapPin} message="No location history yet" />
              ) : (
                <LocationHistoryList locations={locations ?? []} />
              )}
            </PanelCard>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentAlertsWidget alerts={allAlerts} />
        <PredictionTotalizers people={allPeople} />
      </div>
    </div>
  );
}
