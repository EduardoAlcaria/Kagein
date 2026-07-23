import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { usePoints } from './usePoints';

describe('usePoints', () => {
  it('loads points from GET /api/points', async () => {
    server.use(
      http.get('/api/points', () =>
        HttpResponse.json([{ id: 1, label: 'Home', latitude: -23.56, longitude: -46.65 }]),
      ),
    );

    const { result } = renderHook(() => usePoints(), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0].label).toBe('Home');
  });
});
