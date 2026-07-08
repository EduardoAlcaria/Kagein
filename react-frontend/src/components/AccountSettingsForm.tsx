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
        <p className="text-neutral-300">Enter the 2FA code sent to your Apple devices.</p>
        <input
          aria-label="2FA code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-500">
          Submit code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="flex w-80 flex-col gap-4">
      <input
        aria-label="Apple ID"
        value={appleId}
        onChange={(e) => setAppleId(e.target.value)}
        className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-500"
        placeholder="Apple ID"
      />
      <input
        aria-label="Apple ID password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-500"
        placeholder="Password"
      />
      <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-500">
        Add account
      </button>
      {status === 'active' && <p className="text-green-400">Account active.</p>}
    </form>
  );
}
