import { useQuery } from '@tanstack/react-query';
import { fetchPeople } from '../api/client';

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: fetchPeople,
    refetchInterval: 30_000,
  });
}
