import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  useGroupBalances, useSettlePlan, useGroupSettlements, useCreateGroupSettlement, useSettleGroupDebt,
} from '@/hooks/useSettlements';
import { useAuthStore } from '@/stores/authStore';
import WhoPaysNextCard from '@/components/settlements/WhoPaysNextCard';
import SectionHeading from '@/components/ui/SectionHeading';
import EmptyState from '@/components/ui/EmptyState';
import UserAvatar from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ArrowRightLeft, Clock, HandCoins, Loader2, Sparkles } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import UpiPayButton from '@/components/settlements/UpiPayButton';

export default function GroupBalancesSection({ groupId, groupName }: { groupId: string; groupName?: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: balances, isLoading } = useGroupBalances(groupId);
  const { data: settlements } = useGroupSettlements(groupId);
  const settlePlan = useSettlePlan({ groupId });
  const createSettlement = useCreateGroupSettlement(groupId);
  const settleDebt = useSettleGroupDebt(groupId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settleDialog, setSettleDialog] = useState<{
    from: { id: string; name: string };
    to: { id: string; name: string };
    amount: number;
  } | null>(null);

  if (isLoading) {
    return (
      <section>
        <SectionHeading title="Balances" />
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </section>
    );
  }

  const currency = balances?.currency ?? 'USD';
  const debts = balances?.simplifiedDebts ?? [];
  const pendingSettlements = (settlements ?? []).filter((s) => s.status === 'PENDING');
  const allSettled = !!balances && debts.length === 0 && balances.totalExpenses > 0;

  if (!balances || (debts.length === 0 && balances.totalExpenses === 0)) {
    return (
      <section>
        <SectionHeading title="Balances" />
        <EmptyState
          icon={<ArrowRightLeft className="h-7 w-7" />}
          title="No balances yet"
          description="Add a group expense to see who owes whom."
        />
      </section>
    );
  }

  const handleRecordPlan = () => {
    settlePlan.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
  };

  const handleInitiateSettlement = () => {
    if (!settleDialog) return;
    createSettlement.mutate(
      {
        fromUserId: settleDialog.from.id,
        toUserId: settleDialog.to.id,
        amount: settleDialog.amount,
        currency,
      },
      { onSuccess: () => setSettleDialog(null) }
    );
  };

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Balances"
        description="Simplified to fewest transactions"
        action={
          debts.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
              <HandCoins className="h-3.5 w-3.5" />
              Record settlement plan
            </Button>
          ) : undefined
        }
      />

      <WhoPaysNextCard balances={balances} currency={currency} currentUserId={currentUser?.id} />

      {allSettled ? (
        <Card className="bg-success/5 border-success/30">
          <CardContent className="p-6 text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-success/15 text-success mb-2">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="font-semibold text-sm">All settled up!</p>
            <p className="text-xs text-muted-foreground mt-1">Everyone is square in this group.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {debts.map((d, i) => {
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
                      {isMyDebt && (
                        <UpiPayButton
                          payee={d.to}
                          amount={d.amount}
                          currency={currency}
                          contextName={groupName ?? 'TripSplit'}
                          onRecorded={() => setSettleDialog({ from: d.from, to: d.to, amount: d.amount })}
                        />
                      )}
                      <Button
                        size="sm"
                        variant={isMyDebt ? 'default' : 'outline'}
                        onClick={() => setSettleDialog({ from: d.from, to: d.to, amount: d.amount })}
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
      )}

      {pendingSettlements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending settlements</p>
          <Card>
            <ul className="divide-y">
              {pendingSettlements.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Clock className="h-4 w-4 text-warning shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {s.fromUser?.name} → {s.toUser?.name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {formatMoney(s.amount, s.currency)}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">PENDING</Badge>
                  <Button
                    size="sm"
                    onClick={() => settleDebt.mutate({ settlementId: s.id })}
                    disabled={settleDebt.isPending}
                  >
                    {settleDebt.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Mark Settled
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Settlement Plan</DialogTitle>
            <DialogDescription>
              This will create {debts.length} payment request{debts.length !== 1 ? 's' : ''}, replacing any existing pending settlements for this group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {debts.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-1">
                <span className="truncate">
                  <span className="font-medium">{d.from.name}</span>
                  <span className="text-muted-foreground"> pays </span>
                  <span className="font-medium">{d.to.name}</span>
                </span>
                <span className="tabular-nums font-semibold shrink-0 ml-2">{formatMoney(d.amount, currency)}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPlan} disabled={settlePlan.isPending}>
              {settlePlan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!settleDialog} onOpenChange={(open) => { if (!open) setSettleDialog(null); }}>
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
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setSettleDialog(null)}>
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
    </section>
  );
}
