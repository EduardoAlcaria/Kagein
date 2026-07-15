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
    <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <PredictionTotalizers people={people ?? []} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Map</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[420px] overflow-hidden rounded-b-xl">
              <MapPanel
                people={people ?? []}
                selectedPersonId={selectedPersonId}
                onSelectPerson={setSelectedPersonId}
                trail={locations ?? []}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent>
              <PeopleSidebar
                people={people ?? []}
                selectedPersonId={selectedPersonId}
                onSelectPerson={setSelectedPersonId}
              />
            </CardContent>
          </Card>
          {selectedPersonId !== null && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <LocationHistoryList locations={locations ?? []} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <RecentAlertsWidget alerts={alerts ?? []} />
    </div>
  );
}
