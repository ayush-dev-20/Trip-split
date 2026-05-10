import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function SectionHeading({ title, description, action, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-end justify-between gap-3 mb-3 sm:mb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">{title}</h2>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
