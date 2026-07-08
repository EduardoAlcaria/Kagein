import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { PeopleSidebar } from '../components/PeopleSidebar';

export function DashboardPage() {
  const { data: people } = usePeople();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  return (
    <div className="flex h-screen">
      <PeopleSidebar
        people={people ?? []}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
      />
      <div className="flex-1" />
    </div>
  );
}
