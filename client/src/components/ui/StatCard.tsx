import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'destructive' | 'warning' | 'info';
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-muted/50 text-muted-foreground',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

export default function StatCard({ label, value, hint, icon, tone = 'default', className }: StatCardProps) {
  return (
    <Card className={cn('shadow-card', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          {icon && (
            <div className={cn('flex items-center justify-center h-7 w-7 rounded-md', toneClasses[tone])}>
              {icon}
            </div>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-bold mt-2 tracking-tight tabular-nums">{value}</p>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
