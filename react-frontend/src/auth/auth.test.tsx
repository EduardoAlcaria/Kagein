import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { clearCredential } from './credentialStore';

function renderApp() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('auth flow', () => {
  afterEach(() => clearCredential());

  it('redirects to /login when no credential is stored', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Find My Dashboard' })).toBeInTheDocument();
  });

  it('logs in and reaches the protected route', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
  });
});
