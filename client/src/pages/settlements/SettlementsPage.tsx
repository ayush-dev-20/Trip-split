import { useParams } from 'react-router';
import { useBalances, useSettlements, useSettleDebt, useCreateSettlement } from '@/hooks/useSettlements';
import { useTrip } from '@/hooks/useTrips';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import SectionHeading from '@/components/ui/SectionHeading';
import EmptyState from '@/components/ui/EmptyState';
import UserAvatar from '@/components/ui/UserAvatar';
import StatCard from '@/components/ui/StatCard';
import { ArrowRightLeft, CheckCircle, Clock, HandCoins, Loader2, Receipt, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { formatMoney, formatRelativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function SettlementsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const { data: balances, isLoading: balLoading } = useBalances(tripId!);
  const { data: settlements, isLoading: setLoading } = useSettlements(tripId!);
  const settle = useSettleDebt(tripId!);
  const createSettlement = useCreateSettlement(tripId!);

  const [settleDialog, setSettleDialog] = useState<{
    open: boolean;
    from: { id: string; name: string };
    to: { id: string; name: string };
    amount: number;
  } | null>(null);
  const [settleNote, setSettleNote] = useState('');

  if (balLoading || setLoading) return <PageLoader />;

  const currency = balances?.currency ?? trip?.budgetCurrency ?? 'USD';

  const handleInitiateSettlement = () => {
    if (!settleDialog) return;
    createSettlement.mutate(
      {
        fromUserId: settleDialog.from.id,
        toUserId: settleDialog.to.id,
        amount: settleDialog.amount,
        currency,
        note: settleNote || undefined,
      },
      {
        onSuccess: () => {
          setSettleDialog(null);
          setSettleNote('');
        },
      }
    );
  };

  const myBalance = balances?.balances?.find((b) => b.user.id === currentUser?.id);
  const myNet = myBalance?.amount ?? 0;
  const allSettled = balances && balances.simplifiedDebts.length === 0 && balances.totalExpenses > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Settle Up"
        description={trip?.name}
        back={`/trips/${tripId}`}
      />

      {/* Hero balance */}
      {balances && currentUser && (
        <Card className="bg-gradient-to-br from-primary/10 to-info/5 border-primary/10">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {myNet > 0.01 ? "You're owed" : myNet < -0.01 ? 'You owe' : 'You are settled up'}
            </p>
            <p className={cn(
              'text-3xl sm:text-4xl font-bold mt-1 tracking-tight tabular-nums',
              myNet > 0.01 && 'text-success',
              myNet < -0.01 && 'text-destructive'
            )}>
              {formatMoney(Math.abs(myNet), currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Across {balances.totalExpenses} {balances.totalExpenses === 1 ? 'expense' : 'expenses'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      {balances && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Expenses"
            value={balances.totalExpenses}
            icon={<Receipt className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Settled"
            value={balances.totalSettled}
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            tone="success"
          />
        </div>
      )}

      {/* Who Owes Whom */}
      {balances?.simplifiedDebts && balances.simplifiedDebts.length > 0 && (
        <section>
          <SectionHeading
            title="Who Owes Whom"
            description="Simplified to fewest transactions"
          />
          <div className="space-y-2">
            {balances.simplifiedDebts.map((d, i) => {
              const isMyDebt = d.from.id === currentUser?.id;
              const isMyOwed = d.to.id === currentUser?.id;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.2) }}
                >
                  <Card className={cn(
                    isMyDebt && 'border-destructive/30 bg-destructive/5',
                    isMyOwed && 'border-success/30 bg-success/5'
                  )}>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <UserAvatar name={d.from.name} size="sm" />
                        <div className="text-sm flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-medium truncate">{d.from.name}</span>
                          <span className="text-muted-foreground text-xs">pays</span>
                          <span className="font-medium truncate">{d.to.name}</span>
                        </div>
                        <UserAvatar name={d.to.name} size="sm" className="hidden sm:flex" />
                      </div>
                      <div className="flex items-center gap-3 ml-auto">
                        <span className="font-semibold text-base tabular-nums shrink-0">
                          {formatMoney(d.amount, currency)}
                        </span>
                        <Button
                          size="sm"
                          variant={isMyDebt ? 'default' : 'outline'}
                          onClick={() => setSettleDialog({
                            open: true,
                            from: d.from,
                            to: d.to,
                            amount: d.amount,
                          })}
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Settle</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* All settled */}
      {allSettled && (
        <Card className="bg-success/5 border-success/30">
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success/15 text-success mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-semibold text-base">All settled up!</p>
            <p className="text-sm text-muted-foreground mt-1">Everyone is square on this trip.</p>
          </CardContent>
        </Card>
      )}

      {/* Net balances */}
      {balances?.balances && balances.balances.length > 0 && (
        <section>
          <SectionHeading title="Member Balances" />
          <Card>
            <ul className="divide-y">
              {balances.balances.map((b) => (
                <li key={b.user.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar name={b.user.name} size="sm" />
                  <span className="text-sm font-medium flex-1 truncate">
                    {b.user.name}
                    {b.user.id === currentUser?.id && (
                      <span className="text-xs text-muted-foreground font-normal ml-1.5">(You)</span>
                    )}
                  </span>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    b.amount > 0.01 && 'text-success',
                    b.amount < -0.01 && 'text-destructive',
                    Math.abs(b.amount) <= 0.01 && 'text-muted-foreground'
                  )}>
                    {b.amount > 0.01 ? '+' : ''}{formatMoney(b.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Settlement History */}
      <section>
        <SectionHeading title="History" />
        {!settlements || settlements.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="h-7 w-7" />}
            title="No settlements yet"
            description="Settlements will appear here once payments are recorded."
          />
        ) : (
          <Card>
            <ul className="divide-y">
              {settlements.map((s) => (
                <li key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {s.status === 'SETTLED' ? (
                      <CheckCircle className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-warning shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {s.fromUser?.name} → {s.toUser?.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatRelativeDay(s.createdAt)}
                        {s.note && ` · ${s.note}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-8 sm:ml-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatMoney(s.amount, s.currency)}</p>
                      <Badge variant={s.status === 'SETTLED' ? 'outline' : 'secondary'} className="text-[10px] mt-0.5">
                        {s.status}
                      </Badge>
                    </div>
                    {s.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => settle.mutate(s.id)}
                        disabled={settle.isPending}
                      >
                        {settle.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Mark Settled
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Settle Up Dialog */}
      <Dialog open={!!settleDialog} onOpenChange={(open) => { if (!open) { setSettleDialog(null); setSettleNote(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Settlement</DialogTitle>
            <DialogDescription>
              Creates a pending settlement that can be confirmed by either party.
            </DialogDescription>
          </DialogHeader>
          {settleDialog && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <UserAvatar name={settleDialog.from.name} size="md" />
                    <span className="text-xs font-medium truncate w-full text-center">{settleDialog.from.name}</span>
                  </div>
                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <UserAvatar name={settleDialog.to.name} size="md" />
                    <span className="text-xs font-medium truncate w-full text-center">{settleDialog.to.name}</span>
                  </div>
                </div>
                <p className="text-center text-3xl font-bold mt-4 tabular-nums tracking-tight">
                  {formatMoney(settleDialog.amount, currency)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="note"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="e.g. Paid via Venmo"
                  className="h-10"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setSettleDialog(null); setSettleNote(''); }}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleInitiateSettlement} disabled={createSettlement.isPending}>
                  {createSettlement.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {createSettlement.isPending ? 'Recording…' : 'Record Payment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
