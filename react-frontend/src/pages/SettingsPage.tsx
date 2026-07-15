import { AccountSettingsForm } from '../components/AccountSettingsForm';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Find My Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
