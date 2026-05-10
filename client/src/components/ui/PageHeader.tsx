import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  back?: boolean | string;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, back, actions, icon, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="-ml-2 mt-0.5 shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
