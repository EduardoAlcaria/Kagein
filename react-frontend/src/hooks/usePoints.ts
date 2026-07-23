import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPoint, deletePoint, fetchPoints } from '../api/client';
import type { CreatePointRequest } from '../api/types';

export function usePoints() {
  return useQuery({ queryKey: ['points'], queryFn: fetchPoints });
}

export function useCreatePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreatePointRequest) => createPoint(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}

export function useDeletePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePoint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}
