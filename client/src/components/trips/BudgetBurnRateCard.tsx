import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BudgetStatus } from '@/types';

const paceStyles = {
  UNDER: { label: 'Under budget', className: 'bg-success/15 text-success border-success/30' },
  ON_TRACK: { label: 'On track', className: 'bg-primary/15 text-primary border-primary/30' },
  OVER: { label: 'Over pace', className: 'bg-destructive/15 text-destructive border-destructive/30' },
} as const;

export default function BudgetBurnRateCard({ status }: { status: BudgetStatus }) {
  if (status.budget == null || !status.pace) return null;
  const currency = status.currency ?? 'USD';
  const spentPct = Math.min(100, ((status.totalSpent ?? 0) / status.budget) * 100);
  const timePct = Math.min(100, ((status.daysElapsed ?? 0) / (status.tripDays ?? 1)) * 100);
  const ended = (status.daysRemaining ?? 0) === 0 && (status.daysElapsed ?? 0) > 0;
  const pace = paceStyles[status.pace];

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Budget</p>
          <Badge variant="outline" className={cn('text-[10px]', pace.className)}>{pace.label}</Badge>
        </div>

        {/* Two-track: money consumed vs time elapsed */}
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full', status.pace === 'OVER' ? 'bg-destructive' : status.pace === 'UNDER' ? 'bg-success' : 'bg-primary')}
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-foreground/30" style={{ width: `${timePct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatMoney(status.totalSpent ?? 0, currency)} of {formatMoney(status.budget, currency)} spent · day{' '}
            {status.daysElapsed}/{status.tripDays}
          </p>
        </div>

        {ended ? (
          <p className="text-sm">
            {(status.remaining ?? 0) >= 0
              ? <>Finished <span className="font-semibold text-success">{formatMoney(status.remaining ?? 0, currency)}</span> under budget</>
              : <>Over budget by <span className="font-semibold text-destructive">{formatMoney(Math.abs(status.remaining ?? 0), currency)}</span></>}
          </p>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-2xl font-bold tabular-nums', (status.remaining ?? 0) < 0 && 'text-destructive')}>
              {formatMoney(Math.max(status.safePerDay ?? 0, 0), currency)}
            </span>
            <span className="text-xs text-muted-foreground">safe to spend per day · {status.daysRemaining} days left</span>
          </div>
        )}

        {status.byCategory && status.byCategory.length > 0 && (
          <ul className="pt-1 space-y-1 border-t">
            {status.byCategory.slice(0, 5).map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate capitalize">{c.category.toLowerCase()}</span>
                <span className="text-muted-foreground tabular-nums">{c.share}%</span>
                <span className="tabular-nums w-20 text-right">{formatMoney(c.spent, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
