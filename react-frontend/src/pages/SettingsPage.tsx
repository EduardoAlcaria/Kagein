import { AccountSettingsForm } from '../components/AccountSettingsForm';

export function SettingsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-neutral-100">Find My Account</h1>
        <AccountSettingsForm />
      </div>
    </main>
  );
}
