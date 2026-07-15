import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { registerAccount, submitTwoFactorCode } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';

const LABEL_CLASS = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground';

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
        <p className="text-sm text-muted-foreground">
          Enter the 2FA code sent to your Apple devices.
        </p>
        <div>
          <label htmlFor="twofa-code" className={LABEL_CLASS}>
            2FA code
          </label>
          <Input
            id="twofa-code"
            aria-label="2FA code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono tracking-[0.3em]"
            placeholder="123456"
          />
        </div>
        <Button type="submit" disabled={twoFactorMutation.isPending}>
          {twoFactorMutation.isPending ? 'Submitting...' : 'Submit code'}
        </Button>
        {twoFactorMutation.isError && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle size={14} className="shrink-0" />
            Couldn't verify that code. Try again.
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="apple-id" className={LABEL_CLASS}>
          Apple ID
        </label>
        <Input
          id="apple-id"
          aria-label="Apple ID"
          value={appleId}
          onChange={(e) => setAppleId(e.target.value)}
          placeholder="you@icloud.com"
        />
      </div>
      <div>
        <label htmlFor="apple-password" className={LABEL_CLASS}>
          Password
        </label>
        <Input
          id="apple-password"
          aria-label="Apple ID password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? 'Adding...' : 'Add account'}
      </Button>
      {status === 'active' && (
        <p className="flex items-center gap-2 rounded-lg border border-live/20 bg-live/10 p-3 text-sm text-live">
          <CheckCircle2 size={14} className="shrink-0" />
          Account active.
        </p>
      )}
      {registerMutation.isError && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle size={14} className="shrink-0" />
          Couldn't add that account. Check the Apple ID and password.
        </p>
      )}
    </form>
  );
}
