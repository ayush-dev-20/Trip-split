import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  variant?: 'card' | 'plain';
}

export default function EmptyState({ icon, title, description, action, className, variant = 'card' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 sm:py-16',
        variant === 'card' && 'border border-dashed rounded-2xl bg-muted/20',
        className
      )}
    >
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
