import { BarChart3 } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

export default function AnalyticsPage() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Deep dive into your spending patterns</p>
      </div>

      <EmptyState
        icon={<BarChart3 className="h-7 w-7" />}
        title="This page is being reworked"
        description="Personal analytics has moved to the Daily Expense tab, and trip analytics now lives on each trip's page. This section is being redesigned — check back soon."
      />
    </div>
  );
}
