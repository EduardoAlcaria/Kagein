import { useQuery } from '@tanstack/react-query';
import { fetchPersonLocations } from '../api/client';

export function usePersonLocations(personId: number | null) {
  return useQuery({
    queryKey: ['personLocations', personId],
    queryFn: () => fetchPersonLocations(personId as number),
    enabled: personId !== null,
  });
}
