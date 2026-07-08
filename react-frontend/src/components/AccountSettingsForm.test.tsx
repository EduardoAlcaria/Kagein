import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { AccountSettingsForm } from './AccountSettingsForm';

describe('AccountSettingsForm', () => {
  it('walks through register -> 2fa required -> active', async () => {
    server.use(
      http.post('/api/accounts', () => HttpResponse.json({ status: '2fa_required' })),
      http.post('/api/accounts/a%40b.com/2fa', () => HttpResponse.json({ status: 'active' })),
    );

    const user = userEvent.setup();
    render(<AccountSettingsForm />, { wrapper: TestQueryProvider });

    await user.type(screen.getByLabelText('Apple ID'), 'a@b.com');
    await user.type(screen.getByLabelText('Apple ID password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    await user.type(await screen.findByLabelText('2FA code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Submit code' }));

    expect(await screen.findByText('Account active.')).toBeInTheDocument();
  });

  it('shows an error message when registration fails', async () => {
    server.use(http.post('/api/accounts', () => new HttpResponse(null, { status: 401 })));

    const user = userEvent.setup();
    render(<AccountSettingsForm />, { wrapper: TestQueryProvider });

    await user.type(screen.getByLabelText('Apple ID'), 'a@b.com');
    await user.type(screen.getByLabelText('Apple ID password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    expect(await screen.findByText(/Couldn't add that account/)).toBeInTheDocument();
  });
});
