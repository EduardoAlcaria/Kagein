import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { registerAccount, submitTwoFactorCode } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';

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
      <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-4">
        <p className="text-muted-foreground">Enter the 2FA code sent to your Apple devices.</p>
        <Input aria-label="2FA code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" disabled={twoFactorMutation.isPending}>
          {twoFactorMutation.isPending ? 'Submitting...' : 'Submit code'}
        </Button>
        {twoFactorMutation.isError && <p className="text-destructive">Couldn't verify that code. Try again.</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
      <Input
        aria-label="Apple ID"
        value={appleId}
        onChange={(e) => setAppleId(e.target.value)}
        placeholder="Apple ID"
      />
      <Input
        aria-label="Apple ID password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <Button type="submit" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? 'Adding...' : 'Add account'}
      </Button>
      {status === 'active' && <p className="text-primary">Account active.</p>}
      {registerMutation.isError && (
        <p className="text-destructive">Couldn't add that account. Check the Apple ID and password.</p>
      )}
    </form>
  );
}
