import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { registerAccount, submitTwoFactorCode } from '../api/client';

export function AccountSettingsForm() {
  const [appleId, setAppleId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'active' | '2fa_required'>('idle');

  const registerMutation = useMutation({
    mutationFn: () => registerAccount({ appleId, password }),
    onSuccess: (response) => setStatus(response.status),
  });

  const twoFactorMutation = useMutation({
    mutationFn: () => submitTwoFactorCode(appleId, code),
    onSuccess: (response) => setStatus(response.status),
  });

  function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    registerMutation.mutate();
  }

  function handleTwoFactorSubmit(event: FormEvent) {
    event.preventDefault();
    twoFactorMutation.mutate();
  }

  if (status === '2fa_required') {
    return (
      <form onSubmit={handleTwoFactorSubmit} className="flex w-80 flex-col gap-4">
        <p className="text-muted-foreground">Enter the 2FA code sent to your Apple devices.</p>
        <input
          aria-label="2FA code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-foreground"
        />
        <button
          type="submit"
          disabled={twoFactorMutation.isPending}
          className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {twoFactorMutation.isPending ? 'Submitting...' : 'Submit code'}
        </button>
        {twoFactorMutation.isError && (
          <p className="text-destructive">Couldn't verify that code. Try again.</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="flex w-80 flex-col gap-4">
      <input
        aria-label="Apple ID"
        value={appleId}
        onChange={(e) => setAppleId(e.target.value)}
        className="rounded-lg border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground"
        placeholder="Apple ID"
      />
      <input
        aria-label="Apple ID password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground"
        placeholder="Password"
      />
      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {registerMutation.isPending ? 'Adding...' : 'Add account'}
      </button>
      {status === 'active' && <p className="text-primary">Account active.</p>}
      {registerMutation.isError && (
        <p className="text-destructive">Couldn't add that account. Check the Apple ID and password.</p>
      )}
    </form>
  );
}
