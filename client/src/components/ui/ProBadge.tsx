import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small "PRO" pill for marking a gated feature before someone clicks into
 * it — sits next to a button/nav item/option so FREE users see the paywall
 * up front rather than only after an action fails.
 */
export default function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary',
        className
      )}
    >
      <Lock className="h-2.5 w-2.5" /> Pro
    </span>
  );
}
