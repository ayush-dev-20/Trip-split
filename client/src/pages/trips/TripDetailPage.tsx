import { useState, useRef } from 'react';
import type { Components } from 'react-markdown';
import { useParams, Link, useNavigate } from 'react-router';
import { useTrip, useDeleteTrip, useUpdateTrip } from '@/hooks/useTrips';
import { useExpenses } from '@/hooks/useExpenses';
import { useBalances } from '@/hooks/useSettlements';
import {
  useCheckpoints,
  useCreateCheckpointsBulk,
  useUpdateCheckpoint,
  useDeleteCheckpoint,
  useCreateCheckpoint,
  useDeleteAllCheckpoints,
  useDeleteDayCheckpoints,
} from '@/hooks/useCheckpoints';
import { aiService } from '@/services/aiService';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import CheckpointFormDialog from '@/components/ui/CheckpointFormDialog';
import EmptyState from '@/components/ui/EmptyState';
import SectionHeading from '@/components/ui/SectionHeading';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  MapPin, Calendar, Plus, Receipt, ArrowLeft,
  MoreVertical, Trash2, Settings, Share2, ArrowRightLeft, Pencil, Download,
  Sparkles, CheckCircle2, Circle, MapPinned, X, NotebookPen, Loader2,
  Wallet, Printer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { analyticsService } from '@/services/analyticsService';
import { getCategoryStyle } from '@/lib/categoryStyle';
import { formatMoney, formatDate, formatRelativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SuggestedCheckpoint } from '@/types';
import ReactMarkdown from 'react-markdown';

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-lg font-bold mt-1 mb-3 text-foreground leading-snug">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold mt-5 mb-2 pb-1 border-b border-border text-foreground">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2.5 text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="text-sm mb-3 ml-4 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm mb-3 ml-4 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed text-foreground/90">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-3">{children}</blockquote>,
  code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
  hr: () => <hr className="border-border my-4" />,
};

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { data: trip, isLoading } = useTrip(tripId!);
  const { data: expensesData } = useExpenses(tripId!);
  const { data: balances } = useBalances(tripId!);
  const { data: checkpoints = [] } = useCheckpoints(tripId!);
  const deleteTrip = useDeleteTrip();
  const updateTrip = useUpdateTrip();
  const createCheckpoint = useCreateCheckpoint(tripId!);
  const createBulk = useCreateCheckpointsBulk(tripId!);
  const updateCheckpoint = useUpdateCheckpoint(tripId!);
  const deleteCheckpoint = useDeleteCheckpoint(tripId!);
  const deleteAllCheckpoints = useDeleteAllCheckpoints(tripId!);
  const deleteDayCheckpoints = useDeleteDayCheckpoints(tripId!);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAllCheckpointsOpen, setDeleteAllCheckpointsOpen] = useState(false);
  const [deleteDayOpen, setDeleteDayOpen] = useState<number | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planStage, setPlanStage] = useState<'streaming' | 'checkpoints' | null>(null);
  const [itinerary, setItinerary] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedCheckpoint[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const itineraryRef = useRef<HTMLDivElement>(null);
  const [cpFormOpen, setCpFormOpen] = useState<{ defaultDay: number | null; title: string } | null>(null);
  const [detailCp, setDetailCp] = useState<typeof checkpoints[0] | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [pendingCheckpointIds, setPendingCheckpointIds] = useState<Set<string>>(new Set());

  const openCpForm = (defaultDay: number | null, title: string) =>
    setCpFormOpen({ defaultDay, title });

  const handleCreateCheckpoint = (values: import('@/components/ui/CheckpointFormDialog').CheckpointFormValues) => {
    createCheckpoint.mutate(
      {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        category: values.category || undefined,
        estimatedCost: values.estimatedCost ? Number(values.estimatedCost) : undefined,
        day: values.day ? Number(values.day) : undefined,
      },
      { onSuccess: () => setCpFormOpen(null) }
    );
  };

  const handleDownloadExpenses = async () => {
    const data = await analyticsService.getMyExpenses(undefined, tripId);
    const currency = trip?.budgetCurrency ?? 'USD';
    const lines: string[] = [
      `Expense Details — ${trip?.name ?? 'Trip'}`,
      `Downloaded on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
    ];
    data.expenses.forEach((e, idx) => {
      lines.push(`${idx + 1}. ${e.expenseName} — ${currency} ${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    });
    lines.push('');
    lines.push(`Total  ${currency} ${data.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(trip?.name ?? 'trip').replace(/\s+/g, '_')}_expenses.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyInvite = () => {
    if (!trip) return;
    navigator.clipboard.writeText(trip.inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handlePlanItinerary = async () => {
    setPlanStage('streaming');
    setItinerary('');
    setPlanOpen(true);
    setSuggestions([]);
    try {
      await aiService.planForTripStream(
        tripId!,
        (chunk) => setItinerary((prev) => prev + chunk),
        (cps) => {
          setSuggestions(cps);
          setSelectedSuggestions(new Set(cps.map((_, i) => i)));
        },
        () => setPlanStage(null),
        () => setPlanStage('checkpoints'),
      );
    } catch {
      setItinerary('Failed to generate itinerary. Please try again.');
      setPlanStage(null);
    }
  };

  const downloadItineraryAsPdf = () => {
    const content = itineraryRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<title>${trip?.name ?? 'Trip'} — Itinerary</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7;color:#111}
  h1{font-size:1.6rem;font-weight:700;margin:0 0 1rem}
  h2{font-size:1.2rem;font-weight:600;margin:2rem 0 0.5rem;border-bottom:1px solid #e5e7eb;padding-bottom:0.4rem}
  h3{font-size:1rem;font-weight:600;margin:1.5rem 0 0.4rem}
  ul,ol{padding-left:1.5rem;margin:0 0 1rem}
  li{margin:0.3rem 0}
  p{margin:0 0 0.75rem}
  strong{font-weight:600}
  hr{border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0}
  blockquote{border-left:3px solid #6366f1;padding-left:1rem;color:#555;margin:1rem 0}
  @media print{body{margin:20px}}
</style>
</head><body>
<h1>${trip?.name ?? 'Trip'} — Travel Itinerary</h1>
${content}
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSaveCheckpoints = () => {
    const toSave = suggestions
      .filter((_, i) => selectedSuggestions.has(i))
      .map((s, i) => ({
        title: s.title,
        description: s.description,
        category: s.category,
        estimatedCost: s.estimatedCost,
        day: s.day,
        sortOrder: i,
      }));
    if (toSave.length > 0) createBulk.mutate(toSave);
    setPlanOpen(false);
  };

  if (isLoading || !trip) return <PageLoader />;

  const expenses = expensesData?.expenses ?? [];
  const spent = trip.totalSpent ?? expenses.reduce((s, e) => s + (e.convertedAmount ?? e.amount), 0);
  const budgetPct = trip.budgetAmount ? Math.min(100, (spent / trip.budgetAmount) * 100) : null;
  const remaining = trip.budgetAmount ? trip.budgetAmount - spent : null;

  // Derive max day
  const maxDay = checkpoints.reduce((m, cp) => Math.max(m, cp.day ?? 0), 0);
  const availableDays = Array.from(new Set(checkpoints.map((cp) => cp.day).filter((d): d is number => d != null))).sort((a, b) => a - b);

  const groupedCheckpoints = checkpoints.reduce<Record<string, typeof checkpoints>>((acc, cp) => {
    const key = cp.day ? `Day ${cp.day}` : 'Unscheduled';
    (acc[key] ??= []).push(cp);
    return acc;
  }, {});
  const visitedCount = checkpoints.filter((c) => c.isVisited).length;

  // User's net balance
  const myBalance = balances?.balances?.find((b) => b.user.id === currentUser?.id);
  const myNet = myBalance?.amount ?? 0;
  const balanceTone = myNet > 0.01 ? 'positive' : myNet < -0.01 ? 'negative' : 'zero';

  return (
    <div className="space-y-6">
      {/* ── Hero header ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-info/10 border">
        {trip.coverImageUrl && (
          <>
            <img src={trip.coverImageUrl} alt={trip.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          </>
        )}
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/trips')}
              className="-ml-2 -mt-1 h-9 w-9"
              aria-label="Back to trips"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className={cn(
                  'text-[10px] font-semibold',
                  trip.status === 'ACTIVE' && 'bg-success/10 text-success border-success/20',
                  trip.status === 'UPCOMING' && 'bg-info/10 text-info border-info/20',
                  trip.status === 'COMPLETED' && 'bg-muted',
                )}>
                  {trip.status}
                </Badge>
                {trip.startDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(trip.startDate, { withYear: true })}
                    {trip.endDate && <> — {formatDate(trip.endDate, { withYear: true })}</>}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{trip.name}</h1>
              {trip.destination && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {trip.destination}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-9 w-9">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate(`/trips/${tripId}/edit`)}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit Trip
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyInvite}>
                  <Share2 className="h-4 w-4 mr-2" /> {copiedInvite ? 'Copied!' : 'Copy Invite Code'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadExpenses}>
                  <Download className="h-4 w-4 mr-2" /> Export Expenses
                </DropdownMenuItem>
                {trip.status !== 'COMPLETED' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={updateTrip.isPending}
                      onClick={() => updateTrip.mutate({ id: tripId!, status: 'COMPLETED' })}
                    >
                      {updateTrip.isPending
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Settings className="h-4 w-4 mr-2" />}
                      Mark Completed
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Trip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Hero balance */}
          {balances && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-2">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    {balanceTone === 'positive' ? "You're owed" : balanceTone === 'negative' ? 'You owe' : 'You are settled up'}
                  </p>
                  <p className={cn(
                    'text-xl sm:text-2xl font-bold mt-1 tabular-nums',
                    balanceTone === 'positive' && 'text-success',
                    balanceTone === 'negative' && 'text-destructive',
                    balanceTone === 'zero' && 'text-foreground'
                  )}>
                    {formatMoney(Math.abs(myNet), trip.budgetCurrency)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Total Spent
                  </p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums">
                    {formatMoney(spent, trip.budgetCurrency)}
                  </p>
                  {trip.budgetAmount && (
                    <div className="mt-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            (budgetPct ?? 0) > 90 ? 'bg-destructive' :
                            (budgetPct ?? 0) > 75 ? 'bg-warning' : 'bg-primary'
                          )}
                          style={{ width: `${budgetPct ?? 0}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {remaining !== null && remaining >= 0
                          ? `${formatMoney(remaining, trip.budgetCurrency)} left`
                          : `Over budget by ${formatMoney(Math.abs(remaining ?? 0), trip.budgetCurrency)}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick action grid ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { to: `/trips/${tripId}/expenses/new`, icon: Plus, label: 'Add Expense', primary: true },
          { to: `/trips/${tripId}/expenses`, icon: Receipt, label: 'Expenses' },
          { to: `/trips/${tripId}/settlements`, icon: ArrowRightLeft, label: 'Settle Up' },
          { to: `/trips/${tripId}/notes`, icon: NotebookPen, label: 'Notes' },
        ].map(({ to, icon: Icon, label, primary }) => (
          <Button
            key={to}
            asChild
            variant={primary ? 'default' : 'outline'}
            className={cn('h-auto py-3 flex-col gap-1.5', primary && 'shadow-sm')}
          >
            <Link to={to}>
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          </Button>
        ))}
      </div>

      {/* ── Who Owes Whom ────────────────────────────────────── */}
      {balances?.simplifiedDebts && balances.simplifiedDebts.length > 0 && (
        <section>
          <SectionHeading
            title="Who Owes Whom"
            description="Simplified to fewest transactions"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/trips/${tripId}/settlements`}>View all</Link>
              </Button>
            }
          />
          <div className="space-y-2">
            {balances.simplifiedDebts.slice(0, 3).map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <UserAvatar name={d.from.name} size="sm" />
                      <div className="text-sm flex items-center gap-1.5 min-w-0">
                        <span className="font-medium truncate">{d.from.name}</span>
                        <span className="text-muted-foreground text-xs">pays</span>
                        <span className="font-medium truncate">{d.to.name}</span>
                      </div>
                      <UserAvatar name={d.to.name} size="sm" className="hidden sm:flex" />
                    </div>
                    <span className="font-semibold tabular-nums shrink-0">
                      {formatMoney(d.amount, trip.budgetCurrency)}
                    </span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Activity ──────────────────────────────────── */}
      <section>
        <SectionHeading
          title="Recent Activity"
          action={
            expenses.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/trips/${tripId}/expenses`}>View all</Link>
              </Button>
            )
          }
        />
        {expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="No expenses yet"
            description="Add your first expense to start tracking with your group."
            action={
              <Button asChild>
                <Link to={`/trips/${tripId}/expenses/new`}>
                  <Plus className="h-4 w-4" /> Add Expense
                </Link>
              </Button>
            }
          />
        ) : (
          <Card>
            <ul className="divide-y">
              {expenses.slice(0, 6).map((expense) => {
                const cat = getCategoryStyle(expense.category);
                const Icon = cat.icon;
                return (
                  <li key={expense.id}>
                    <Link
                      to={`/trips/${tripId}/expenses/${expense.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg shrink-0', cat.bg)}>
                        <Icon className={cn('h-5 w-5', cat.fg)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{expense.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {expense.paidBy?.name} · {formatRelativeDay(expense.date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums shrink-0">
                        {formatMoney(expense.amount, expense.currency)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Members ──────────────────────────────────────────── */}
      {trip.members && trip.members.length > 0 && (
        <section>
          <SectionHeading
            title={`Members (${trip.members.length})`}
            action={
              <Button variant="ghost" size="sm" onClick={handleCopyInvite}>
                <Share2 className="h-3.5 w-3.5" /> {copiedInvite ? 'Copied' : 'Invite'}
              </Button>
            }
          />
          <div className="flex flex-wrap gap-2">
            {trip.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border"
              >
                <UserAvatar name={m.user?.name} size="xs" />
                <span className="text-sm font-medium">{m.user?.name}</span>
                {m.role === 'ADMIN' && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Admin</Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Itinerary / Checkpoints ──────────────────────────── */}
      <section>
        <SectionHeading
          title="Itinerary"
          description={
            checkpoints.length > 0
              ? `${visitedCount} of ${checkpoints.length} checkpoints visited`
              : undefined
          }
          action={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => openCpForm(maxDay + 1, `Add to Day ${maxDay + 1}`)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
              {checkpoints.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteAllCheckpointsOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          }
        />

        {checkpoints.length > 0 && (
          <div className="mb-4 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${(visitedCount / checkpoints.length) * 100}%` }}
            />
          </div>
        )}

        {checkpoints.length === 0 ? (
          <EmptyState
            icon={<MapPinned className="h-7 w-7" />}
            title="No checkpoints yet"
            description="Plan your trip with destinations, activities, and stops."
            action={
              trip.destination && (
                <Button variant="outline" onClick={handlePlanItinerary} disabled={planStage !== null}>
                  {planStage !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {planStage !== null ? 'Generating…' : 'Generate with AI'}
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedCheckpoints).map(([day, items]) => (
              <div key={day}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const dayNum = day.startsWith('Day ') ? parseInt(day.replace('Day ', ''), 10) : null;
                        openCpForm(dayNum, dayNum !== null ? `Add to Day ${dayNum}` : 'Add Checkpoint');
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-accent"
                      aria-label="Add checkpoint to this day"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    {day !== 'Unscheduled' && (
                      <button
                        onClick={() => {
                          const dayNum = parseInt(day.replace('Day ', ''), 10);
                          if (!isNaN(dayNum)) setDeleteDayOpen(dayNum);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-accent"
                        aria-label="Delete day"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {items.map((cp) => (
                      <motion.div
                        key={cp.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Card
                          className="group cursor-pointer hover:shadow-card-hover transition-shadow"
                          onClick={() => setDetailCp(cp)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <button
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (pendingCheckpointIds.has(cp.id)) return;
                                setPendingCheckpointIds(prev => new Set(prev).add(cp.id));
                                updateCheckpoint.mutate(
                                  { id: cp.id, data: { isVisited: !cp.isVisited } },
                                  { onSettled: () => setPendingCheckpointIds(prev => { const s = new Set(prev); s.delete(cp.id); return s; }) }
                                );
                              }}
                              disabled={pendingCheckpointIds.has(cp.id)}
                              style={{ touchAction: 'manipulation' }}
                              className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -mx-1"
                              aria-label={cp.isVisited ? 'Mark not visited' : 'Mark visited'}
                            >
                              {cp.isVisited ? (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground/40" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-sm font-medium',
                                cp.isVisited && 'line-through text-muted-foreground'
                              )}>
                                {cp.title}
                              </p>
                              {cp.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{cp.description}</p>
                              )}
                            </div>
                            <div className="hidden sm:flex items-center gap-2 shrink-0">
                              {cp.category && (
                                <Badge variant="outline" className="text-[10px]">{cp.category}</Badge>
                              )}
                              {cp.estimatedCost != null && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  ~{formatMoney(cp.estimatedCost, trip.budgetCurrency)}
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteCheckpoint.mutate(cp.id); }}
                                disabled={deleteCheckpoint.isPending}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                aria-label="Delete checkpoint"
                              >
                                {deleteCheckpoint.isPending
                                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  : <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />}
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => openCpForm(null, 'Add Checkpoint')}
            >
              <Plus className="h-4 w-4" /> Add Checkpoint
            </Button>
          </div>
        )}
      </section>

      {/* ── AI Itinerary Dialog ──────────────────────────────── */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-3xl flex flex-col gap-0 p-0" style={{ maxHeight: '85vh' }}>

          {/* Header */}
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Trip Itinerary
            </DialogTitle>
          </DialogHeader>

          {/* 3-step progress indicator — visible only while generating */}
          {planStage !== null && (
            <div className="shrink-0 flex items-center gap-2 px-6 py-3 bg-muted/40 border-b text-xs">
              {/* Step 1 — Creating Itinerary */}
              <div className="flex items-center gap-1.5">
                {planStage === 'streaming'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                }
                <span className={cn('font-medium', planStage === 'streaming' ? 'text-foreground' : 'text-muted-foreground')}>
                  Creating Itinerary
                </span>
              </div>
              <div className="flex-1 h-px bg-border min-w-[16px]" />
              {/* Step 2 — Generating Checkpoints */}
              <div className="flex items-center gap-1.5">
                {planStage === 'checkpoints'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                }
                <span className={cn('font-medium', planStage === 'checkpoints' ? 'text-foreground' : 'text-muted-foreground')}>
                  Generating Checkpoints
                </span>
              </div>
              <div className="flex-1 h-px bg-border min-w-[16px]" />
              {/* Step 3 — Save */}
              <div className="flex items-center gap-1.5">
                <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
                <span className="text-muted-foreground/60">Save Checkpoints</span>
              </div>
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-5">

            {/* Initial spinner — before first token arrives */}
            {planStage === 'streaming' && !itinerary && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analysing your trip details…</p>
              </div>
            )}

            {/* Itinerary content */}
            {itinerary && (
              <Card>
                <CardContent className="p-5">
                  <div ref={itineraryRef}>
                    <ReactMarkdown components={mdComponents}>{itinerary}</ReactMarkdown>
                  </div>
                  {/* Streaming cursor */}
                  {planStage === 'streaming' && (
                    <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse rounded-sm ml-0.5 align-middle" />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Suggested Checkpoints */}
            {suggestions.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-1">Suggested Checkpoints</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Select the places you'd like to add to your trip checklist.
                </p>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <Card
                      key={i}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selectedSuggestions.has(i) && 'border-primary bg-primary/5'
                      )}
                      onClick={() => toggleSuggestion(i)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Checkbox checked={selectedSuggestions.has(i)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.title}</p>
                          {s.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                          {s.estimatedCost > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              ~{formatMoney(s.estimatedCost, trip.budgetCurrency)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer — always visible */}
          <div className="shrink-0 border-t px-6 py-4 bg-background">
            <div className="flex items-center gap-2">
              {/* Close — always on the left */}
              <Button variant="ghost" onClick={() => setPlanOpen(false)}>
                Close
              </Button>

              {/* Download buttons — appear once generation is fully done */}
              {itinerary && planStage === null && (
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={downloadItineraryAsPdf}>
                    <Printer className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              )}
            </div>

            {/* Save Checkpoints row — prominently separated when suggestions are ready */}
            {suggestions.length > 0 && planStage === null && (
              <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {selectedSuggestions.size} of {suggestions.length} checkpoint{suggestions.length !== 1 ? 's' : ''} selected
                </p>
                <Button
                  onClick={handleSaveCheckpoints}
                  disabled={selectedSuggestions.size === 0 || createBulk.isPending}
                >
                  {createBulk.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save {selectedSuggestions.size} Checkpoint{selectedSuggestions.size !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>

      {/* ── Checkpoint Detail Dialog ─────────────────────────── */}
      <Dialog open={!!detailCp} onOpenChange={(open) => { if (!open) setDetailCp(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={detailCp?.isVisited ? 'line-through text-muted-foreground' : ''}>
              {detailCp?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {detailCp?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{detailCp.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {detailCp?.category && <Badge variant="outline">{detailCp.category}</Badge>}
              {detailCp?.day != null && <Badge variant="secondary">Day {detailCp.day}</Badge>}
              {detailCp?.estimatedCost != null && (
                <Badge variant="outline" className="font-mono">
                  <Wallet className="h-3 w-3 mr-1" />
                  {formatMoney(detailCp.estimatedCost, trip.budgetCurrency)}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant={detailCp?.isVisited ? 'secondary' : 'success'}
                size="sm"
                disabled={detailCp ? pendingCheckpointIds.has(detailCp.id) : false}
                style={{ touchAction: 'manipulation' }}
                onClick={() => {
                  if (!detailCp) return;
                  setPendingCheckpointIds(prev => new Set(prev).add(detailCp.id));
                  updateCheckpoint.mutate(
                    { id: detailCp.id, data: { isVisited: !detailCp.isVisited } },
                    {
                      onSuccess: () => setDetailCp((prev) => prev ? { ...prev, isVisited: !prev.isVisited } : null),
                      onSettled: () => setPendingCheckpointIds(prev => { const s = new Set(prev); s.delete(detailCp.id); return s; }),
                    }
                  );
                }}
              >
                {detailCp && pendingCheckpointIds.has(detailCp.id) && <Loader2 className="h-4 w-4 animate-spin" />}
                {detailCp?.isVisited ? 'Mark Not Visited' : 'Mark Visited'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteCheckpoint.isPending}
                onClick={() => {
                  if (!detailCp) return;
                  deleteCheckpoint.mutate(detailCp.id, { onSuccess: () => setDetailCp(null) });
                }}
              >
                {deleteCheckpoint.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add checkpoint form ──────────────────────────────── */}
      <CheckpointFormDialog
        open={cpFormOpen !== null}
        onOpenChange={(open) => { if (!open) setCpFormOpen(null); }}
        defaultDay={cpFormOpen?.defaultDay ?? null}
        availableDays={availableDays}
        title={cpFormOpen?.title ?? 'Add Checkpoint'}
        loading={createCheckpoint.isPending}
        onSubmit={handleCreateCheckpoint}
      />

      <ConfirmationDialog
        open={deleteAllCheckpointsOpen}
        onOpenChange={setDeleteAllCheckpointsOpen}
        title="Clear all checkpoints?"
        description="This will permanently delete all checkpoints for this trip. This cannot be undone."
        confirmLabel="Clear all"
        loading={deleteAllCheckpoints.isPending}
        onConfirm={() => deleteAllCheckpoints.mutate()}
      />

      <ConfirmationDialog
        open={deleteDayOpen !== null}
        onOpenChange={(open) => { if (!open) setDeleteDayOpen(null); }}
        title={`Delete Day ${deleteDayOpen} checkpoints?`}
        description={`This will permanently delete all checkpoints for Day ${deleteDayOpen}. This cannot be undone.`}
        confirmLabel="Delete day"
        loading={deleteDayCheckpoints.isPending}
        onConfirm={() => { if (deleteDayOpen !== null) deleteDayCheckpoints.mutate(deleteDayOpen); }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Trip"
        description="Are you sure you want to delete this trip? All expenses and settlements will be permanently removed. This cannot be undone."
        confirmLabel="Delete Trip"
        loading={deleteTrip.isPending}
        onConfirm={() => deleteTrip.mutate(tripId!, { onSuccess: () => navigate('/trips') })}
      />
    </div>
  );
}
