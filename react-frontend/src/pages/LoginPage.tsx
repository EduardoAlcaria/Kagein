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
    <main className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
        <h1 className="text-xl font-semibold text-foreground">Find My Dashboard</h1>
        <input
          aria-label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground"
          placeholder="Username"
        />
        <input
          aria-label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground"
          placeholder="Password"
        />
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">
          Log in
        </button>
      </form>
    </main>
  );
}
