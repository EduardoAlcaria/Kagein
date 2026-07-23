import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createZone, deleteZone, fetchZones } from '../api/client';
import type { CreateZoneRequest } from '../api/types';

export function useZones() {
  return useQuery({ queryKey: ['zones'], queryFn: fetchZones });
}

export function useCreateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateZoneRequest) => createZone(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteZone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
