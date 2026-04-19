import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useTrip, useDeleteTrip, useUpdateTrip } from '@/hooks/useTrips';
import { useExpenses } from '@/hooks/useExpenses';
import { useBalances } from '@/hooks/useSettlements';
import { useCheckpoints, useCreateCheckpointsBulk, useUpdateCheckpoint, useDeleteCheckpoint, useCreateCheckpoint, useDeleteAllCheckpoints, useDeleteDayCheckpoints } from '@/hooks/useCheckpoints';
import { aiService } from '@/services/aiService';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import CheckpointFormDialog from '@/components/ui/CheckpointFormDialog';
import {
  MapPin, Calendar, DollarSign, Plus, Receipt, ArrowLeft,
  MoreVertical, Trash2, Settings, Share2, ArrowRightLeft, Pencil, Download,
  Sparkles, CheckCircle2, Circle, MapPinned, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { analyticsService } from '@/services/analyticsService';
import type { SuggestedCheckpoint } from '@/types';
import ReactMarkdown from 'react-markdown';

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
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
  const [planning, setPlanning] = useState(false);
  const [itinerary, setItinerary] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedCheckpoint[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  // { defaultDay: number|null, title: string } — null means dialog closed
  const [cpFormOpen, setCpFormOpen] = useState<{ defaultDay: number | null; title: string } | null>(null);

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

  const handlePlanItinerary = async () => {
    setPlanning(true);
    setItinerary('');
    setPlanOpen(true);
    setSuggestions([]);
    try {
      await aiService.planForTripStream(
        tripId!,
        (chunk) => setItinerary((prev) => prev + chunk),
        (checkpoints) => {
          setSuggestions(checkpoints);
          setSelectedSuggestions(new Set(checkpoints.map((_, i) => i)));
        },
        () => setPlanning(false)
      );
    } catch {
      setItinerary('Failed to generate itinerary. Please try again.');
      setPlanning(false);
    }
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
    if (toSave.length > 0) {
      createBulk.mutate(toSave);
    }
    setPlanOpen(false);
  };

  // Derive max day and sorted list of existing days for "Add Day" button / day select
  const maxDay = checkpoints.reduce((m, cp) => Math.max(m, cp.day ?? 0), 0);
  const availableDays = Array.from(new Set(checkpoints.map((cp) => cp.day).filter((d): d is number => d != null))).sort(
    (a, b) => a - b
  );

  // Group checkpoints by day
  const groupedCheckpoints = checkpoints.reduce<Record<string, typeof checkpoints>>((acc, cp) => {
    const key = cp.day ? `Day ${cp.day}` : 'Unscheduled';
    (acc[key] ??= []).push(cp);
    return acc;
  }, {});
  const visitedCount = checkpoints.filter((c) => c.isVisited).length;

  if (isLoading || !trip) return <PageLoader />;  const expenses = expensesData?.expenses ?? [];
  const spent = trip.totalSpent ?? expenses.reduce((s, e) => s + (e.convertedAmount ?? e.amount), 0);
  const budgetPct = trip.budgetAmount ? Math.min(100, (spent / trip.budgetAmount) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/trips')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
              {trip.destination && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {trip.destination}</span>
              )}
              {trip.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(trip.startDate).toLocaleDateString()} — {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'Ongoing'}
                </span>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="self-end sm:self-auto">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/trips/${tripId}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Trip
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadExpenses}>
              <Download className="h-4 w-4 mr-2" /> Download Expenses
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(trip.inviteCode)}>
              <Share2 className="h-4 w-4 mr-2" /> Copy Invite Code
            </DropdownMenuItem>
            {trip.status !== 'COMPLETED' && (
              <DropdownMenuItem onClick={() => updateTrip.mutate({ id: tripId!, status: 'COMPLETED' })}>
                <Settings className="h-4 w-4 mr-2" /> Mark Completed
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Trip
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-xl font-bold mt-1">
              {trip.budgetCurrency} {spent.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        {trip.budgetAmount && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-xl font-bold mt-1">
                {trip.budgetCurrency} {trip.budgetAmount.toFixed(2)}
              </p>
              <Progress
                value={budgetPct ?? 0}
                className="mt-2 h-1.5"
              />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="text-xl font-bold mt-1">{trip._count?.members ?? trip.members?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-xl font-bold mt-1">{trip._count?.expenses ?? expenses.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Button asChild>
          <Link to={`/trips/${tripId}/expenses/new`}>
            <Plus className="h-4 w-4 mr-2" /> Add Expense
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to={`/trips/${tripId}/expenses`}>
            <Receipt className="h-4 w-4 mr-2" /> All Expenses
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to={`/trips/${tripId}/settlements`}>
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Settlements
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/analytics">
            <DollarSign className="h-4 w-4 mr-2" /> Analytics
          </Link>
        </Button>
        {trip.destination && (
          <Button variant="secondary" onClick={handlePlanItinerary} disabled={planning}>
            <Sparkles className="h-4 w-4 mr-2" />
            {planning ? 'Planning…' : 'Plan Itinerary'}
          </Button>
        )}
      </div>

      {/* Simplified Debts */}
      {balances?.simplifiedDebts && balances.simplifiedDebts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Who Owes Who</h2>
          <div className="space-y-2">
            {balances.simplifiedDebts.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{d.from.name}</span>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{d.to.name}</span>
                    </div>
                    <span className="font-semibold text-destructive">
                      {trip.budgetCurrency} {d.amount.toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
          <Button variant="link" asChild className="p-0 h-auto text-primary">
            <Link to={`/trips/${tripId}/expenses`}>View all →</Link>
          </Button>
        </div>
        {expenses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No expenses yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {expenses.slice(0, 5).map((expense) => (
              <Link key={expense.id} to={`/trips/${tripId}/expenses/${expense.id}`}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted text-muted-foreground text-xs font-medium shrink-0">
                        {expense.category.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.paidBy?.name} · {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0 ml-3">
                      {expense.currency} {expense.amount.toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Members */}
      {trip.members && trip.members.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Members</h2>
          <div className="flex flex-wrap gap-2">
            {trip.members.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-2 px-3 py-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {m.user?.name?.charAt(0) ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{m.user?.name}</span>
                  {m.role === 'ADMIN' && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Checkpoints */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Checkpoints</h2>
            {checkpoints.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {visitedCount}/{checkpoints.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => openCpForm(maxDay + 1, `Add to Day ${maxDay + 1}`)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Day
            </Button>
            {checkpoints.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                onClick={() => setDeleteAllCheckpointsOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
              </Button>
            )}
          </div>
        </div>

        {checkpoints.length > 0 && (
          <Progress value={(visitedCount / checkpoints.length) * 100} className="mb-4 h-2" />
        )}

        {checkpoints.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPinned className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No checkpoints yet</p>
              {trip.destination && (
                <Button variant="secondary" size="sm" onClick={handlePlanItinerary} disabled={planning}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {planning ? 'Generating…' : 'Generate with AI'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedCheckpoints).map(([day, items]) => (
              <div key={day}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{day}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const dayNum = day.startsWith('Day ') ? parseInt(day.replace('Day ', ''), 10) : null;
                        openCpForm(dayNum, dayNum !== null ? `Add to Day ${dayNum}` : 'Add Checkpoint');
                      }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors p-0.5"
                      title="Add checkpoint to this day"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const dayNum = day.startsWith('Day ') ? parseInt(day.replace('Day ', ''), 10) : null;
                        if (dayNum !== null) setDeleteDayOpen(dayNum);
                      }}
                      className={`text-xs text-muted-foreground hover:text-destructive transition-colors p-0.5 ${
                        day === 'Unscheduled' ? 'hidden' : ''
                      }`}
                      title="Delete all checkpoints in this day"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
                        <Card className="group">
                          <CardContent className="p-3 flex items-center gap-3">
                            <button
                              onClick={() =>
                                updateCheckpoint.mutate({ id: cp.id, data: { isVisited: !cp.isVisited } })
                              }
                              className="shrink-0"
                            >
                              {cp.isVisited ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground/40" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${cp.isVisited ? 'line-through text-muted-foreground' : ''}`}>
                                {cp.title}
                              </p>
                              {cp.description && (
                                <p className="text-xs text-muted-foreground truncate">{cp.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {cp.category && (
                                <Badge variant="outline" className="text-[10px]">{cp.category}</Badge>
                              )}
                              {cp.estimatedCost != null && (
                                <span className="text-xs text-muted-foreground">
                                  ~{trip.budgetCurrency} {cp.estimatedCost}
                                </span>
                              )}
                              <button
                                onClick={() => deleteCheckpoint.mutate(cp.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
          </div>
        )}

        {/* Add checkpoint */}
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full border-dashed"
          onClick={() => openCpForm(null, 'Add Checkpoint')}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Checkpoint
        </Button>
      </div>

      {/* Plan Itinerary Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> AI Trip Itinerary
            </DialogTitle>
          </DialogHeader>

          {planning ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Generating your itinerary…</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Itinerary Markdown */}
              {itinerary && (
                <Card>
                  <CardContent className="p-6 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mt-6 mb-2 pb-1 border-b border-border text-foreground">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h4>,
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-sm text-muted-foreground">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 my-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-1 my-2">{children}</ol>,
                        li: ({ children }) => <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>,
                        hr: () => <hr className="my-4 border-border" />,
                        code: ({ children }) => (
                          <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full text-sm border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                        th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2 border-b border-border text-muted-foreground">{children}</td>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary/40 pl-4 my-3 italic text-muted-foreground">{children}</blockquote>
                        ),
                      }}
                    >
                      {itinerary}
                    </ReactMarkdown>
                  </CardContent>
                </Card>
              )}

              {/* Suggested Checkpoints */}
              {suggestions.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3">Suggested Checkpoints</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select the places you'd like to add to your trip checklist.
                  </p>
                  <div className="space-y-2">
                    {suggestions.map((s, i) => (
                      <Card
                        key={i}
                        className={`cursor-pointer transition-colors ${selectedSuggestions.has(i) ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => toggleSuggestion(i)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <Checkbox checked={selectedSuggestions.has(i)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{s.title}</p>
                            <p className="text-xs text-muted-foreground">{s.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                            {s.estimatedCost > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ~{trip.budgetCurrency} {s.estimatedCost}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4 gap-2">
                    <Button variant="ghost" onClick={() => setPlanOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveCheckpoints} disabled={selectedSuggestions.size === 0}>
                      Save {selectedSuggestions.size} Checkpoint{selectedSuggestions.size !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / edit checkpoint form */}
      <CheckpointFormDialog
        open={cpFormOpen !== null}
        onOpenChange={(open) => { if (!open) setCpFormOpen(null); }}
        defaultDay={cpFormOpen?.defaultDay ?? null}
        availableDays={availableDays}
        title={cpFormOpen?.title ?? 'Add Checkpoint'}
        loading={createCheckpoint.isPending}
        onSubmit={handleCreateCheckpoint}
      />

      {/* Delete all checkpoints */}
      <ConfirmationDialog
        open={deleteAllCheckpointsOpen}
        onOpenChange={setDeleteAllCheckpointsOpen}
        title="Clear all checkpoints?"
        description="This will permanently delete all checkpoints for this trip. This cannot be undone."
        confirmLabel="Clear all"
        loading={deleteAllCheckpoints.isPending}
        onConfirm={() => deleteAllCheckpoints.mutate()}
      />

      {/* Delete day checkpoints */}
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
