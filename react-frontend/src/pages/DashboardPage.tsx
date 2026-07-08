import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../auth/AuthContext';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { AlertsPanel } from '../components/AlertsPanel';
import { AlertBanner } from '../components/AlertBanner';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const { logout } = useAuth();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex h-screen flex-col bg-background">
      <AlertBanner alerts={alerts ?? []} />
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2 text-card-foreground">
        <h1 className="font-semibold">Find My Dashboard</h1>
        <div className="flex items-center gap-4">
          <Link to="/settings" className="text-sm text-primary hover:underline">
            Settings
          </Link>
          <button type="button" onClick={logout} className="text-sm text-muted-foreground hover:underline">
            Log out
          </button>
        </div>
      </header>
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
