import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { AlertsPanel } from '../components/AlertsPanel';
import { AlertBanner } from '../components/AlertBanner';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      <AlertBanner alerts={alerts ?? []} />
      <div className="flex flex-1">
        <PeopleSidebar
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
        />
        <div className="flex-1">
          <MapView
            people={people ?? []}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            trail={locations ?? []}
          />
        </div>
        {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
        <AlertsPanel alerts={alerts ?? []} />
      </div>
    </div>
  );
}
