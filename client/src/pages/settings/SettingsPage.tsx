import { useAuthStore } from '@/stores/authStore';
import { useUpdateProfile } from '@/hooks/useAuth';
import { useClerk } from '@clerk/clerk-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, DollarSign, Bell, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const { openUserProfile } = useClerk();

  const [name, setName] = useState(user?.name ?? '');
  const [currency, setCurrency] = useState(user?.preferredCurrency ?? 'USD');
  const [emailNotif, setEmailNotif] = useState(user?.emailNotifications ?? true);
  const [pushNotif, setPushNotif] = useState(user?.pushNotifications ?? true);
  const [weeklyReport, setWeeklyReport] = useState(user?.weeklyReport ?? true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name, preferredCurrency: currency, emailNotifications: emailNotif, pushNotifications: pushNotif, weeklyReport });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <form onSubmit={handleSaveProfile}>
        <Card>
          <CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" /> Profile
            </h2>

            {updateProfile.isSuccess && (
              <Alert>
                <AlertDescription>Profile updated successfully!</AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Email</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
            </div>

            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
            </div>

            <div>
              <Label className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> Default Currency
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Notifications */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </h2>
          {[
            { label: 'Email Notifications', desc: 'Receive email updates about expenses and settlements', checked: emailNotif, onChange: setEmailNotif },
            { label: 'Push Notifications', desc: 'Get browser push notifications', checked: pushNotif, onChange: setPushNotif },
            { label: 'Weekly Report', desc: 'Receive a weekly spending summary email', checked: weeklyReport, onChange: setWeeklyReport },
          ].map(({ label, desc, checked, onChange }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={checked} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security — managed by Clerk */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Password, two-factor authentication, and connected accounts are managed through your Clerk account portal.
          </p>
          <Button variant="secondary" type="button" onClick={() => openUserProfile()}>
            Manage Security Settings
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Badge */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {user?.tier ?? 'FREE'}
                <Badge variant="secondary">{user?.tier ?? 'FREE'}</Badge>
              </p>
            </div>
            <Button asChild>
              <Link to="/settings/billing">Manage Plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
