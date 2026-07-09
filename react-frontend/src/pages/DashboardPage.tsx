import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapPanel } from '../components/MapPanel';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { PredictionTotalizers } from '../components/PredictionTotalizers';
import { RecentAlertsWidget } from '../components/RecentAlertsWidget';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex flex-col">
      <PredictionTotalizers people={people ?? []} />
      <div className="flex h-[calc(100vh-49px)]">
        <PeopleSidebar
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
        />
        <div className="flex-1">
          <MapPanel
            people={people ?? []}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            trail={locations ?? []}
          />
        </div>
        {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
      </div>
      <RecentAlertsWidget alerts={alerts ?? []} />
    </div>
  );
}
