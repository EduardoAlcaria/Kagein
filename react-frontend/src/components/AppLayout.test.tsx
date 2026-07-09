import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { AuthProvider } from '../auth/AuthContext';
import { useSidebar } from './ui/sidebar';
import { AppLayout } from './AppLayout';

function SidebarState() {
  const { state } = useSidebar();
  return <div data-testid="sidebar-state">{state}</div>;
}

describe('AppLayout', () => {
  it('toggles the sidebar collapsed/expanded state via the trigger', async () => {
    server.use(http.get('/api/alerts', () => HttpResponse.json([])));

    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <AuthProvider>
          <MemoryRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route
                  path="/"
                  element={
                    <>
                      <div>Dashboard content</div>
                      <SidebarState />
                    </>
                  }
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </TestQueryProvider>,
    );

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');

    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
  });

  it.each([
    ['/', 'Dashboard'],
    ['/settings', 'Settings'],
  ])('shows the page title for %s in the header', async (initialRoute, expectedLabel) => {
    server.use(http.get('/api/alerts', () => HttpResponse.json([])));

    render(
      <TestQueryProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<div>Dashboard content</div>} />
                <Route path="/settings" element={<div>Settings content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </TestQueryProvider>,
    );

    expect(await screen.findByRole('heading', { level: 2, name: expectedLabel })).toBeInTheDocument();
  });
});
