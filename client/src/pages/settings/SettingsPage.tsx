import { useAuthStore } from '@/stores/authStore';
import { useUpdateProfile } from '@/hooks/useAuth';
import { useClerk } from '@clerk/clerk-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Bell, Shield, CreditCard, Loader2, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router';
import PageHeader from '@/components/ui/PageHeader';
import SectionHeading from '@/components/ui/SectionHeading';
import UserAvatar from '@/components/ui/UserAvatar';

const UPI_REGEX = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const { openUserProfile } = useClerk();

  const [name, setName] = useState(user?.name ?? '');
  const [currency, setCurrency] = useState(user?.preferredCurrency ?? 'USD');
  const [upiId, setUpiId] = useState(user?.upiId ?? '');
  const [monthlyBudget, setMonthlyBudget] = useState(user?.monthlyBudget?.toString() ?? '');
  const [budgetCurrency, setBudgetCurrency] = useState(user?.monthlyBudgetCurrency ?? user?.preferredCurrency ?? 'USD');
  const [emailNotif, setEmailNotif] = useState(user?.emailNotifications ?? true);
  const [pushNotif, setPushNotif] = useState(user?.pushNotifications ?? true);
  const [weeklyReport, setWeeklyReport] = useState(user?.weeklyReport ?? true);

  const isUpiInvalid = upiId.trim().length > 0 && !UPI_REGEX.test(upiId.trim());

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpiInvalid) return;
    const parsedBudget = monthlyBudget.trim() ? Number(monthlyBudget) : null;
    updateProfile.mutate({
      name,
      preferredCurrency: currency,
      monthlyBudget: parsedBudget && parsedBudget > 0 ? parsedBudget : null,
      monthlyBudgetCurrency: budgetCurrency,
      upiId: upiId.trim() || null,
      emailNotifications: emailNotif,
      pushNotifications: pushNotif,
      weeklyReport,
    });
  };

  const tier = user?.tier ?? 'FREE';
  const tierColors: Record<string, string> = {
    FREE: 'bg-muted text-muted-foreground',
    PRO: 'bg-primary/10 text-primary',
    TEAM: 'bg-warning/10 text-warning',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage your account preferences" />

      {/* Profile card with avatar */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <UserAvatar name={user?.name} src={user?.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{user?.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={tierColors[tier]}>
                {tier === 'FREE' ? '' : <Sparkles className="h-3 w-3 mr-1" />}
                {tier} Plan
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <form onSubmit={handleSaveProfile}>
        <SectionHeading title="Profile" />
        <Card>
          <CardContent className="p-5 space-y-5">
            {updateProfile.isSuccess && (
              <Alert className="border-success/30 bg-success/5 text-success-foreground">
                <AlertDescription className="text-success">
                  Profile updated successfully!
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground font-normal">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input value={user?.email ?? ''} disabled className="h-10 bg-muted/30" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyBudget" className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5" /> Monthly Budget
              </Label>
              <div className="flex gap-2">
                <Input
                  id="monthlyBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="e.g. 30000"
                  className="h-10 flex-1"
                />
                <Select value={budgetCurrency} onValueChange={setBudgetCurrency}>
                  <SelectTrigger className="h-10 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Track spending against a monthly limit on the Daily Expense tab. Leave blank to disable.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upiId" className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5" /> UPI ID
              </Label>
              <Input
                id="upiId"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@bank"
                className={cn('h-10', isUpiInvalid && 'border-destructive focus-visible:ring-destructive')}
              />
              {isUpiInvalid && (
                <p className="text-xs text-destructive">Invalid UPI ID (e.g. name@bank)</p>
              )}
              <p className="text-xs text-muted-foreground">
                Lets friends pay you directly from settlements. Leave blank to disable.
              </p>
            </div>

            <Button type="submit" disabled={updateProfile.isPending || isUpiInvalid}>
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Notifications */}
      <div>
        <SectionHeading title="Notifications" description="Choose how you want to be notified" />
        <Card>
          <ul className="divide-y">
            {[
              { key: 'email', icon: Mail, label: 'Email notifications', desc: 'Updates about expenses and settlements', checked: emailNotif, onChange: setEmailNotif },
              { key: 'push', icon: Bell, label: 'Push notifications', desc: 'Browser push alerts', checked: pushNotif, onChange: setPushNotif },
              { key: 'weekly', icon: Sparkles, label: 'Weekly report', desc: 'Spending summary every Monday', checked: weeklyReport, onChange: setWeeklyReport },
            ].map(({ key, icon: Icon, label, desc, checked, onChange }) => (
              <li key={key} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="flex gap-3 flex-1 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
                <Switch checked={checked} onCheckedChange={onChange} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Plan */}
      <div>
        <SectionHeading title="Subscription" />
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <p className="text-base font-semibold">{tier}</p>
              </div>
            </div>
            <Button asChild variant={tier === 'FREE' ? 'default' : 'outline'}>
              <Link to="/settings/billing">
                {tier === 'FREE' ? 'Upgrade' : 'Manage Plan'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Security */}
      <div>
        <SectionHeading title="Security" />
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Account security</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Password, 2FA, and connected accounts are managed via Clerk.
                </p>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={() => openUserProfile()}>
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
