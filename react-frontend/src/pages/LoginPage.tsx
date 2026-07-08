import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login({ username, password });
    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold">Find My Dashboard</h1>
        <input
          aria-label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Username"
        />
        <input
          aria-label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Password"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">
          Log in
        </button>
      </form>
    </main>
  );
}
