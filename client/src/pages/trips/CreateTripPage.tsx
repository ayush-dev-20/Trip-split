import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateTrip } from '@/hooks/useTrips';
import { useGroups } from '@/hooks/useGroups';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'];

export default function CreateTripPage() {
  const navigate = useNavigate();
  const { data: groups, isLoading } = useGroups();
  const createTrip = useCreateTrip();

  const [form, setForm] = useState({
    name: '',
    description: '',
    destination: '',
    startDate: '',
    endDate: '',
    budgetCurrency: 'USD',
    budgetAmount: '',
    groupId: '',
    isPublic: false,
  });

  if (isLoading) return <PageLoader />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTrip.mutate(
      {
        name: form.name,
        description: form.description || undefined,
        destination: form.destination || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        budget: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        budgetCurrency: form.budgetCurrency,
        groupId: form.groupId || undefined,
        isPublic: form.isPublic,
      },
      { onSuccess: (trip) => navigate(`/trips/${trip.id}`) }
    );
  };

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="New Trip"
        description="Plan your next adventure"
        back
        icon={<div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary"><Plane className="h-5 w-5" /></div>}
      />

      {createTrip.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createTrip.error as Error)?.message || 'Failed to create trip'}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic */}
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Trip Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Bali Adventure 2026"
                required
                autoFocus
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={form.destination}
                onChange={(e) => update('destination', e.target.value)}
                placeholder="e.g. Bali, Indonesia"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Brief description (optional)"
                className="min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates & Budget */}
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                  min={form.startDate || undefined}
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-1">
                <Label>Currency</Label>
                <Select value={form.budgetCurrency} onValueChange={(v) => update('budgetCurrency', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="budget">Budget <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="budget"
                  type="number"
                  value={form.budgetAmount}
                  onChange={(e) => update('budgetAmount', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="h-10 tabular-nums"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardContent className="p-5 space-y-5">
            {groups && groups.length > 0 && (
              <div className="space-y-2">
                <Label>Group <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={form.groupId} onValueChange={(v) => update('groupId', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="No group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">You can add this trip to a group later.</p>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="isPublic"
                checked={form.isPublic}
                onCheckedChange={(c) => update('isPublic', c as boolean)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="isPublic" className="font-medium cursor-pointer">
                  Public trip
                </Label>
                <p className="text-xs text-muted-foreground">
                  Make this trip publicly viewable.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createTrip.isPending || !form.name.trim()} className="flex-1">
            {createTrip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createTrip.isPending ? 'Creating...' : 'Create Trip'}
          </Button>
        </div>
      </form>
    </div>
  );
}
