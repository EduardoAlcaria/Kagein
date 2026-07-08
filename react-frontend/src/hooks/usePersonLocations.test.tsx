import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { usePersonLocations } from './usePersonLocations';

describe('usePersonLocations', () => {
  it('loads history for the given person id', async () => {
    server.use(
      http.get('/api/people/1/locations', () =>
        HttpResponse.json([{ latitude: 37.33, longitude: -122.0, capturedAt: '2026-07-06T12:00:00Z' }]),
      ),
    );

    const { result } = renderHook(() => usePersonLocations(1), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('does not fetch when personId is null', () => {
    const { result } = renderHook(() => usePersonLocations(null), { wrapper: TestQueryProvider });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
