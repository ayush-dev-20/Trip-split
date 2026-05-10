import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTrip, useUpdateTrip } from '@/hooks/useTrips';
import { useGroups } from '@/hooks/useGroups';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TripStatus } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'];
const STATUS_OPTIONS: { label: string; value: TripStatus }[] = [
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

// Convert ISO datetime string → date input value (YYYY-MM-DD)
function toDateInput(iso?: string) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function EditTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId!);
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const updateTrip = useUpdateTrip();

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
    status: 'UPCOMING' as TripStatus,
  });

  // Populate form once trip data loads
  useEffect(() => {
    if (!trip) return;
    setForm({
      name: trip.name,
      description: trip.description ?? '',
      destination: trip.destination ?? '',
      startDate: toDateInput(trip.startDate),
      endDate: toDateInput(trip.endDate),
      budgetCurrency: trip.budgetCurrency ?? 'USD',
      budgetAmount: trip.budgetAmount != null ? String(trip.budgetAmount) : '',
      groupId: trip.groupId ?? '',
      isPublic: trip.isPublic,
      status: trip.status,
    });
  }, [trip]);

  if (tripLoading || groupsLoading) return <PageLoader />;
  if (!trip) return null;

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTrip.mutate(
      {
        id: tripId!,
        name: form.name,
        description: form.description || undefined,
        destination: form.destination || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        budget: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        budgetCurrency: form.budgetCurrency || 'USD',
        groupId: form.groupId || undefined,
        isPublic: form.isPublic,
        status: form.status,
      },
      { onSuccess: () => navigate(`/trips/${tripId}`) }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader title="Edit Trip" description="Update your trip details" back />

      {updateTrip.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {(updateTrip.error as Error)?.message || 'Failed to update trip'}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => update('status', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Group <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={form.groupId} onValueChange={(v) => update('groupId', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="No group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No group</SelectItem>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="isPublic"
                checked={form.isPublic}
                onCheckedChange={(checked) => update('isPublic', checked as boolean)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="isPublic" className="font-medium cursor-pointer">Public trip</Label>
                <p className="text-xs text-muted-foreground">Make this trip publicly viewable.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateTrip.isPending} className="flex-1">
            {updateTrip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {updateTrip.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
