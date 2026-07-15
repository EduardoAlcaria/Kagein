import { AccountSettingsForm } from '../components/AccountSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 lg:p-6">
      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle>Find My Account</CardTitle>
          <CardDescription>
            Connect the Apple ID whose people you want to track. The password is encrypted before it
            is stored and is never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
