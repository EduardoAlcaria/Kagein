import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { useAlerts } from './useAlerts';

describe('useAlerts', () => {
  it('loads alerts from GET /api/alerts', async () => {
    server.use(
      http.get('/api/alerts', () =>
        HttpResponse.json([
          { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'stale', triggeredAt: '2026-07-06T12:00:00Z' },
        ]),
      ),
    );

    const { result } = renderHook(() => useAlerts(), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });
});
