import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CATEGORY_CHART_COLORS } from '@/lib/categoryStyle';

// ─── Consistent colour palette ────────────────────────────
export const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d97706',
];

export const SPLIT_COLORS: Record<string, string> = {
  EQUAL: '#3b82f6',
  PERCENTAGE: '#f59e0b',
  EXACT: '#10b981',
  SHARES: '#8b5cf6',
};

export function getCategoryColor(category: string, idx: number) {
  // categoryStyle.ts is the single source of truth for category colours; COLORS
  // only covers non-category series that also use this helper.
  return CATEGORY_CHART_COLORS[category] || COLORS[idx % COLORS.length];
}

export function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

// Compact format for chart axis ticks — uses the real currency symbol (e.g. ₹, $, €)
export function fmtTick(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

// ─── Stat Card ────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, sub, className }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chart Card wrapper ───────────────────────────────────
// scrollable=true wraps children in a horizontal scroll container with a
// minimum width so charts don't get squished on narrow phone screens.
export function ChartCard({ title, children, className, minW = 280 }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  minW?: number;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <div className="chart-scroll -mx-1 px-1">
          <div style={{ minWidth: minW }}>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom tooltip ───────────────────────────────────────
export function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, currency || '') : p.value}
        </p>
      ))}
    </div>
  );
}
