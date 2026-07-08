import { AccountSettingsForm } from '../components/AccountSettingsForm';

export function SettingsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Find My Account</h1>
        <AccountSettingsForm />
      </div>
    </main>
  );
}
