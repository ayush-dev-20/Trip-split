import { useState } from 'react';
import { Link } from 'react-router';
import { Sparkles, Wallet, TrendingUp, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { aiService } from '@/services/aiService';
import { cn } from '@/lib/utils';
import type { AIBudgetStatus, AIPredictedCost } from '@/types';

type Scope = 'trip' | 'group' | 'personal';
type ErrorKind = 'upgrade' | 'no_budget' | 'failed';

interface CardResult<T> {
  data: T | null;
  error: ErrorKind | null;
}

function getErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function toErrorKind(err: unknown): ErrorKind {
  const code = getErrorCode(err);
  if (code === 'UPGRADE_REQUIRED') return 'upgrade';
  if (code === 'NO_BUDGET_SET') return 'no_budget';
  return 'failed';
}

export default function AIInsightsPanel({ scope, tripId, groupId, currency = 'USD' }: {
  scope: Scope;
  tripId?: string;
  groupId?: string;
  currency?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<CardResult<AIBudgetStatus>>({ data: null, error: null });
  const [predictedCost, setPredictedCost] = useState<CardResult<AIPredictedCost>>({ data: null, error: null });
  const [insights, setInsights] = useState<CardResult<string>>({ data: null, error: null });

  const showBudgetStatus = scope !== 'group';
  const showPredictedCost = scope !== 'group';

  // Each insight is its own request, so each can fail — and be retried — independently.
  const runBudgetStatus = () =>
    aiService.insightsBudgetStatus(scope as 'trip' | 'personal', tripId)
      .then((data) => setBudgetStatus({ data, error: null }))
      .catch((err) => setBudgetStatus({ data: null, error: toErrorKind(err) }));

  const runPredictedCost = () =>
    aiService.insightsPredictedCost(scope as 'trip' | 'personal', tripId)
      .then((data) => setPredictedCost({ data, error: null }))
      .catch((err) => setPredictedCost({ data: null, error: toErrorKind(err) }));

  const runInsights = () =>
    aiService.insightsSpending(scope, { tripId, groupId })
      .then((data) => setInsights({ data, error: null }))
      .catch((err) => setInsights({ data: null, error: toErrorKind(err) }));

  const generate = async () => {
    setLoading(true);
    setHasRun(true);

    const jobs: Promise<void>[] = [];
    if (showBudgetStatus) jobs.push(runBudgetStatus());
    if (showPredictedCost) jobs.push(runPredictedCost());
    jobs.push(runInsights());

    await Promise.allSettled(jobs);
    setLoading(false);
  };

  const [retrying, setRetrying] = useState<'budget' | 'predicted' | 'insights' | null>(null);
  const retry = async (which: 'budget' | 'predicted' | 'insights', run: () => Promise<void>) => {
    setRetrying(which);
    await run();
    setRetrying(null);
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">AI Insights</p>
          </div>
          <Button size="sm" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {hasRun ? 'Regenerate' : 'Generate Insights'}
          </Button>
        </div>

        {!hasRun && (
          <p className="text-xs text-muted-foreground">
            Get an AI-generated read on {scope === 'group' ? "this group's" : scope === 'trip' ? "this trip's" : 'your'} spending.
          </p>
        )}

        {showBudgetStatus && (budgetStatus.data || budgetStatus.error) && (
          <InsightCard
            icon={Wallet}
            title="Budget Status"
            result={budgetStatus}
            onRetry={() => retry('budget', runBudgetStatus)}
            retrying={retrying === 'budget'}
          >
            {budgetStatus.data && (
              <>
                <p className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  budgetStatus.data.status === 'over' ? 'text-destructive' :
                  budgetStatus.data.status === 'under' ? 'text-green-600' : 'text-muted-foreground',
                )}>
                  {budgetStatus.data.status === 'over' ? 'Over pace' : budgetStatus.data.status === 'under' ? 'Under pace' : 'On track'}
                </p>
                <p className="text-sm mt-1">{budgetStatus.data.summary}</p>
                {budgetStatus.data.tips.length > 0 && (
                  <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside space-y-0.5">
                    {budgetStatus.data.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                )}
              </>
            )}
          </InsightCard>
        )}

        {showPredictedCost && (predictedCost.data || predictedCost.error) && (
          <InsightCard
            icon={TrendingUp}
            title="Predicted Total Cost"
            result={predictedCost}
            onRetry={() => retry('predicted', runPredictedCost)}
            retrying={retrying === 'predicted'}
          >
            {predictedCost.data && (
              <>
                <p className="text-lg font-bold tabular-nums">{formatMoney(predictedCost.data.predictedTotal, currency)}</p>
                <p className="text-xs text-muted-foreground mt-1">{predictedCost.data.reasoning} · {predictedCost.data.confidence} confidence</p>
              </>
            )}
          </InsightCard>
        )}

        {(insights.data || insights.error) && (
          <InsightCard
            icon={Lightbulb}
            title="Insights"
            result={insights}
            onRetry={() => retry('insights', runInsights)}
            retrying={retrying === 'insights'}
          >
            {insights.data && <p className="text-sm whitespace-pre-wrap leading-relaxed">{insights.data}</p>}
          </InsightCard>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCard<T>({ icon: Icon, title, result, onRetry, retrying = false, children }: {
  icon: React.ElementType;
  title: string;
  result: CardResult<T>;
  /** Re-runs just this card's request. Only offered for failures a retry can fix. */
  onRetry?: () => void;
  retrying?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      </div>
      {result.error === 'upgrade' && (
        <p className="text-xs text-muted-foreground">
          This is a higher-tier feature. <Link to="/settings/billing" className="text-primary hover:underline">Upgrade</Link> to unlock it.
        </p>
      )}
      {result.error === 'no_budget' && (
        <p className="text-xs text-muted-foreground">No budget set yet — add one to see this.</p>
      )}
      {result.error === 'failed' && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-destructive">Unable to generate right now.</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Try again
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
