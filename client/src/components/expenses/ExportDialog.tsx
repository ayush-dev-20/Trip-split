import { useState } from 'react';
import { FileText, Printer, CalendarRange, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type ExportRange = { startDate?: string; endDate?: string };

type PresetId = 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom';

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'last7',     label: 'Last 7 days' },
  { id: 'last30',    label: 'Last 30 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear',  label: 'This year' },
  { id: 'all',       label: 'All time' },
  { id: 'custom',    label: 'Custom range' },
];

const toISODate = (d: Date) => {
  // Local calendar date (not UTC) — an expense logged today should land in
  // "today" regardless of the user's timezone offset.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0];
};

/** Resolves a preset into concrete dates. `all` intentionally returns no bounds. */
function resolvePreset(preset: PresetId): ExportRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case 'last7':
      return { startDate: toISODate(new Date(y, m, d - 6)), endDate: toISODate(now) };
    case 'last30':
      return { startDate: toISODate(new Date(y, m, d - 29)), endDate: toISODate(now) };
    case 'thisMonth':
      return { startDate: toISODate(new Date(y, m, 1)), endDate: toISODate(now) };
    case 'lastMonth':
      return { startDate: toISODate(new Date(y, m - 1, 1)), endDate: toISODate(new Date(y, m, 0)) };
    case 'thisYear':
      return { startDate: toISODate(new Date(y, 0, 1)), endDate: toISODate(now) };
    case 'all':
    default:
      return {};
  }
}

export default function ExportDialog({
  open,
  onOpenChange,
  onExport,
  title = 'Export expenses',
  description = 'Choose the period you want to export.',
  formats = ['csv', 'pdf'],
  allowAllTime = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: 'csv' | 'pdf', range: ExportRange) => Promise<void> | void;
  title?: string;
  description?: string;
  /** Which download buttons to offer. Analytics reports are PDF-only. */
  formats?: ('csv' | 'pdf')[];
  /** Reports that need a bounded window (analytics) opt out of "All time". */
  allowAllTime?: boolean;
}) {
  const [preset, setPreset] = useState<PresetId>('last30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const presets = allowAllTime ? PRESETS : PRESETS.filter((p) => p.id !== 'all');

  const isCustom = preset === 'custom';
  const customIncomplete = isCustom && !(customStart && customEnd);
  const customInverted = isCustom && !!customStart && !!customEnd && customStart > customEnd;
  const disabled = customIncomplete || customInverted || busy;

  const currentRange = (): ExportRange =>
    isCustom ? { startDate: customStart, endDate: customEnd } : resolvePreset(preset);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (disabled) return;
    setBusy(true);
    setFailed(false);
    try {
      // Stay open until the file actually arrives, so a failure can be shown
      // rather than the dialog vanishing and nothing downloading.
      await onExport(format, currentRange());
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left',
                  preset === p.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isCustom && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="mt-1 h-9"
                    aria-label="Export range start date"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="mt-1 h-9"
                    aria-label="Export range end date"
                  />
                </div>
              </div>
              {customInverted && (
                <p className="text-xs text-destructive">The start date must be before the end date.</p>
              )}
            </div>
          )}

          {!isCustom && preset !== 'all' && (
            <p className="text-xs text-muted-foreground">
              {resolvePreset(preset).startDate} → {resolvePreset(preset).endDate}
            </p>
          )}
          {preset === 'all' && (
            <p className="text-xs text-muted-foreground">Every expense on record will be included.</p>
          )}

          {failed && (
            <p className="text-xs text-destructive">
              The download failed. Please check your connection and try again.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {formats.includes('csv') && (
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={disabled}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} CSV
            </Button>
          )}
          {formats.includes('pdf') && (
            <Button onClick={() => handleExport('pdf')} disabled={disabled}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
