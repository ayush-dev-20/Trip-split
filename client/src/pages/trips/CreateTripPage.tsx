import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateTrip } from '@/hooks/useTrips';
import { useGroups } from '@/hooks/useGroups';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        // Convert date-only (YYYY-MM-DD) to full ISO string required by the server
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        budget: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        budgetCurrency: form.budgetCurrency,
        // Send undefined instead of '' so Zod's .uuid().optional() doesn't reject it
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create New Trip</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plan your next adventure</p>
        </div>
      </div>

      {createTrip.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createTrip.error as Error)?.message || 'Failed to create trip'}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trip Details</CardTitle>
          <CardDescription>Fill in the details for your new trip</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label>Trip Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Bali Adventure 2026"
                required
              />
            </div>

            {/* Group */}
            <div className="space-y-2">
              <Label>Group <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={form.groupId} onValueChange={(v) => update('groupId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">You can add this trip to a group later.</p>
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input
                value={form.destination}
                onChange={(e) => update('destination', e.target.value)}
                placeholder="e.g. Bali, Indonesia"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Brief description of the trip..."
                className="min-h-[80px]"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Currency + Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Currency</Label>
                <Select value={form.budgetCurrency} onValueChange={(v) => update('budgetCurrency', v)}>
                  <SelectTrigger>
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
                <Label>Budget</Label>
                <Input
                  type="number"
                  value={form.budgetAmount}
                  onChange={(e) => update('budgetAmount', e.target.value)}
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Public */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublic"
                checked={form.isPublic}
                onCheckedChange={(checked) => update('isPublic', checked as boolean)}
              />
              <Label htmlFor="isPublic" className="font-normal cursor-pointer">
                Make this trip publicly viewable
              </Label>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTrip.isPending} className="flex-1">
                {createTrip.isPending ? 'Creating...' : 'Create Trip'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
