import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface CheckpointFormValues {
  title: string;
  description: string;
  category: string;
  estimatedCost: string;
  day: string;
}

interface CheckpointFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill a specific day (e.g. when clicking "+ to Day 2") */
  defaultDay?: number | null;
  /** All day numbers that already exist for this trip */
  availableDays?: number[];
  /** Label shown in the header e.g. "Add to Day 3" */
  title?: string;
  loading?: boolean;
  onSubmit: (values: CheckpointFormValues) => void;
}

const CATEGORIES = [
  { value: 'sightseeing', label: '🏛️ Sightseeing' },
  { value: 'food', label: '🍜 Food & Dining' },
  { value: 'activity', label: '🎯 Activity' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'transport', label: '🚌 Transport' },
  { value: 'accommodation', label: '🏨 Accommodation' },
  { value: 'other', label: '📌 Other' },
];

const EMPTY: CheckpointFormValues = {
  title: '',
  description: '',
  category: '',
  estimatedCost: '',
  day: '',
};

export default function CheckpointFormDialog({
  open,
  onOpenChange,
  defaultDay,
  availableDays = [],
  title = 'Add Checkpoint',
  loading = false,
  onSubmit,
}: CheckpointFormDialogProps) {
  const [form, setForm] = useState<CheckpointFormValues>(EMPTY);

  // Reset + pre-fill whenever dialog opens
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, day: defaultDay != null ? String(defaultDay) : '' });
    }
  }, [open, defaultDay]);

  const set = (field: keyof CheckpointFormValues) => (val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-title">
              Place / Activity <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-title"
              placeholder="e.g. Eiffel Tower, Street food market"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-desc">Description</Label>
            <Textarea
              id="cp-desc"
              placeholder="Brief notes about this stop…"
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Category + Day on same row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={set('category')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={form.day} onValueChange={set('day')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day…" />
                </SelectTrigger>
                <SelectContent>
                  {availableDays.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Day {d}
                    </SelectItem>
                  ))}
                  {/* Show the pre-filled day even if it's a brand-new day not yet in the list */}
                  {defaultDay != null && !availableDays.includes(defaultDay) && (
                    <SelectItem value={String(defaultDay)}>
                      Day {defaultDay} (new)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estimated cost */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-cost">Estimated Cost</Label>
            <Input
              id="cp-cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.estimatedCost}
              onChange={(e) => set('estimatedCost')(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!form.title.trim() || loading}>
              {loading ? 'Adding…' : 'Add Checkpoint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
