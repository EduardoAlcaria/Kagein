import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { usePeople } from './usePeople';

describe('usePeople', () => {
  it('loads people from GET /api/people', async () => {
    server.use(
      http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])),
    );

    const { result } = renderHook(() => usePeople(), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].name).toBe('Jane Doe');
  });
});
