import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { AlertsPage } from './AlertsPage';

describe('AlertsPage', () => {
  it('renders the full alert history', async () => {
    server.use(
      http.get('/api/alerts', () =>
        HttpResponse.json([
          { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'Jane is stale', triggeredAt: '2026-07-06T12:00:00Z' },
          { id: 2, personId: 2, type: 'STALE_UPDATE', message: 'John is stale', triggeredAt: '2026-07-06T13:00:00Z' },
        ]),
      ),
    );

    render(
      <TestQueryProvider>
        <AlertsPage />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Jane is stale')).toBeInTheDocument();
    expect(screen.getByText('John is stale')).toBeInTheDocument();
  });
});
