import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PersonalBudgetStatus } from '@/types';

const paceStyles = {
  UNDER: { label: 'Under budget', className: 'bg-success/15 text-success border-success/30' },
  ON_TRACK: { label: 'On track', className: 'bg-primary/15 text-primary border-primary/30' },
  OVER: { label: 'Over pace', className: 'bg-destructive/15 text-destructive border-destructive/30' },
} as const;

export default function PersonalBudgetCard({ status }: { status: PersonalBudgetStatus }) {
  if (status.budget == null || !status.pace) return null;
  const currency = status.currency ?? 'INR';
  const spentPct = Math.min(100, ((status.totalSpent ?? 0) / status.budget) * 100);
  const timePct = Math.min(100, ((status.daysElapsed ?? 0) / (status.daysInMonth ?? 1)) * 100);
  const pace = paceStyles[status.pace];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Monthly Budget</p>
          <Badge variant="outline" className={cn('text-[10px]', pace.className)}>{pace.label}</Badge>
        </div>

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
            {status.daysElapsed}/{status.daysInMonth}
          </p>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-xl font-bold tabular-nums', (status.remaining ?? 0) < 0 && 'text-destructive')}>
            {formatMoney(Math.max(status.safePerDay ?? 0, 0), currency)}
          </span>
          <span className="text-xs text-muted-foreground">safe to spend per day · {status.daysRemaining} days left</span>
        </div>
      </CardContent>
    </Card>
  );
}
