import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { PredictionPage } from './PredictionPage';

function renderAt(path: string) {
  return render(
    <TestQueryProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/prediction" element={<PredictionPage />} />
        </Routes>
      </MemoryRouter>
    </TestQueryProvider>,
  );
}

describe('PredictionPage', () => {
  it('shows a coming-soon message for the selected person', async () => {
    server.use(http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])));

    renderAt('/prediction?personId=1');

    expect(await screen.findByText('Coming soon for Jane Doe.')).toBeInTheDocument();
  });

  it('shows a generic message with no person selected', () => {
    renderAt('/prediction');

    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });
});
