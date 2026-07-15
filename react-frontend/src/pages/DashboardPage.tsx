import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapPanel } from '../components/MapPanel';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { PredictionTotalizers } from '../components/PredictionTotalizers';
import { RecentAlertsWidget } from '../components/RecentAlertsWidget';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      <PredictionTotalizers people={people ?? []} />
      <div className="relative min-h-0 flex-1">
        <MapPanel
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          trail={locations ?? []}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-full max-w-[19rem] flex-col gap-3 p-3">
          <Card className="pointer-events-auto max-h-64 overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">People</CardTitle>
            </CardHeader>
            <CardContent className="max-h-44 overflow-y-auto">
              <PeopleSidebar
                people={people ?? []}
                selectedPersonId={selectedPersonId}
                onSelectPerson={setSelectedPersonId}
              />
            </CardContent>
          </Card>
          {selectedPersonId !== null && (
            <Card className="pointer-events-auto max-h-56 overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">History</CardTitle>
              </CardHeader>
              <CardContent className="max-h-36 overflow-y-auto">
                <LocationHistoryList locations={locations ?? []} />
              </CardContent>
            </Card>
          )}
          <div className="pointer-events-auto mt-auto">
            <RecentAlertsWidget alerts={alerts ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
