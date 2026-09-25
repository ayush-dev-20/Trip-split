import { AlertCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Standard "the AI failed" state. Every AI-generating feature shows this on
 * failure so people always get the same clear message and a way to try again.
 * Omit `onRetry` for failures a retry can't fix (it then shows the message only).
 */
export default function AIErrorNotice({
  message = 'AI is unavailable right now. Please try again.',
  onRetry,
  retrying = false,
  onDismiss,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Adds a close button — for banners that would otherwise linger over the page. */
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex items-start gap-2 text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {(onRetry || onDismiss) && (
        <div className="flex shrink-0 items-center gap-1 self-start sm:self-auto">
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Try again
            </Button>
          )}
          {onDismiss && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
