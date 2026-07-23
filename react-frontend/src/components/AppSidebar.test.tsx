import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { clearCredential, getCredential, setCredential } from '../auth/credentialStore';
import { SidebarProvider } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';

function renderSidebar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('AppSidebar', () => {
  afterEach(() => clearCredential());

  it('renders every nav item with its route', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Alerts/ })).toHaveAttribute('href', '/alerts');
    expect(screen.getByRole('link', { name: /Prediction/ })).toHaveAttribute('href', '/prediction');
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/settings');
  });

  it('shows the logged-in username and logs out on click', async () => {
    setCredential({ username: 'admin', password: 'hunter2' });
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText('admin')).toBeInTheDocument();

    await user.click(screen.getByText('admin'));
    await user.click(await screen.findByText('Log out'));

    expect(getCredential()).toBeNull();
  });
});
