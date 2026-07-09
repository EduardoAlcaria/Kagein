import { AccountSettingsForm } from '../components/AccountSettingsForm';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function SettingsPage() {
  return (
    <div className="flex justify-center p-6">
      <Card className="w-96">
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
