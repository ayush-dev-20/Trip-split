import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { aiService } from '@/services/aiService';
import { getAIError } from '@/lib/aiError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  /** Enables the AI description helper, which uses the trip's details for context. */
  tripId?: string;
  /** Pre-fill a specific day (e.g. when clicking "+ to Day 2") — ignored if initialValues is set */
  defaultDay?: number | null;
  /** All day numbers that already exist for this trip */
  availableDays?: number[];
  /** Label shown in the header e.g. "Add to Day 3" */
  title?: string;
  /** When set, the dialog pre-fills from these values and behaves as an edit form */
  initialValues?: CheckpointFormValues | null;
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
  tripId,
  defaultDay,
  availableDays = [],
  title = 'Add Checkpoint',
  initialValues = null,
  loading = false,
  onSubmit,
}: CheckpointFormDialogProps) {
  const isEdit = initialValues != null;
  const [form, setForm] = useState<CheckpointFormValues>(EMPTY);

  // AI description helper
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Reset + pre-fill once each time the dialog opens. Guarded because callers pass
  // `initialValues` as a fresh object every render — without this, any parent
  // re-render (e.g. a background refetch) would wipe what the user typed or the
  // description the AI just wrote.
  const prefilled = useRef(false);
  useEffect(() => {
    if (open) {
      if (!prefilled.current) {
        prefilled.current = true;
        setForm(initialValues ?? { ...EMPTY, day: defaultDay != null ? String(defaultDay) : '' });
      }
    } else {
      prefilled.current = false;
      setAiOpen(false);
    }
  }, [open, defaultDay, initialValues]);

  const set = (field: keyof CheckpointFormValues) => (val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit(form);
  };

  const openAiPrompt = () => {
    setAiPrompt('');
    setAiError(null);
    setAiOpen(true);
  };

  const handleGenerateDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !form.title.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const description = await aiService.checkpointDescription({
        tripId,
        title: form.title.trim(),
        category: form.category || undefined,
        day: form.day ? Number(form.day) : undefined,
        currentDescription: form.description.trim() || undefined,
        prompt: aiPrompt.trim() || undefined,
      });
      // Only fills the field — nothing is saved until the checkpoint form itself is submitted.
      set('description')(description);
      setAiOpen(false);
    } catch (err) {
      setAiError(getAIError(err, 'Could not generate a description right now. Please try again.').message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-desc">Description</Label>
              {tripId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary hover:text-primary"
                  onClick={openAiPrompt}
                  disabled={!form.title.trim()}
                  title={form.title.trim() ? 'Write description with AI' : 'Enter a place or activity first'}
                  aria-label="Write description with AI"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
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
              {loading ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Checkpoint')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* AI description prompt. A sibling of the form dialog, not a child of its <form>:
        React submit events bubble through portals and would also submit the checkpoint. */}
    <Dialog open={aiOpen} onOpenChange={(o) => { if (!aiLoading) setAiOpen(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Write description with AI
          </DialogTitle>
          <DialogDescription>
            We'll use "{form.title.trim()}" and your trip's details. Tell us what the description should say.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGenerateDescription} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-ai-prompt">Anything specific?</Label>
            <Textarea
              id="cp-ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              maxLength={500}
              placeholder="e.g. mention the best time to visit and one thing not to miss, keep it to two lines…"
              className="min-h-[90px] resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {form.description.trim()
                ? 'This will replace the current description (you can still edit it before saving).'
                : 'Leave this blank for a short, helpful description.'}
            </p>
            {aiError && <p className="text-xs text-destructive">{aiError}</p>}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setAiOpen(false)} disabled={aiLoading} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={aiLoading} className="flex-1">
              {aiLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing…</>
                : aiError
                  ? <><RefreshCw className="h-4 w-4" /> Try again</>
                  : <><Sparkles className="h-4 w-4" /> Generate</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
