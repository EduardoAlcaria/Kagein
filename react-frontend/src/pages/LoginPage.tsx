import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, History, MapPin, Radio } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const FEATURES = [
  { icon: Radio, text: 'Live location for everyone in your Find My circle' },
  { icon: Bell, text: 'Alerts the moment someone stops reporting' },
  { icon: History, text: 'Location history and trails on the map' },
  { icon: MapPin, text: 'Saved places to watch for arrivals' },
];

const LABEL_CLASS = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground';

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
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden p-16 lg:flex">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 30%, oklch(0.5429 0.2366 268.4747 / 0.16) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, oklch(0.78 0.16 155 / 0.07) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="animate-fade-up relative z-10 max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <MapPin size={18} className="text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Find My</span>
          </div>

          <h1 className="mb-4 text-[2.4rem] font-bold leading-[1.15] text-foreground">
            Everyone you
            <br />
            care about,
            <br />
            <span className="text-primary">on one map.</span>
          </h1>
          <p className="mb-10 leading-relaxed text-muted-foreground">
            A private dashboard for your family's Find My locations. Self-hosted, no third parties.
          </p>

          <div className="stagger space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="animate-fade-up flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted">
                  <Icon size={13} className="text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-8 lg:max-w-[440px] lg:border-l">
        <div className="animate-fade-up w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MapPin size={15} className="text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">Find My</span>
          </div>

          <h2 className="mb-1 text-2xl font-bold text-foreground">Find My Dashboard</h2>
          <p className="mb-7 text-sm text-muted-foreground">Sign in to see where everyone is.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="username" className={LABEL_CLASS}>
                Username
              </label>
              <Input
                id="username"
                aria-label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div>
              <label htmlFor="password" className={LABEL_CLASS}>
                Password
              </label>
              <Input
                id="password"
                aria-label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="mt-1">
              Log in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
