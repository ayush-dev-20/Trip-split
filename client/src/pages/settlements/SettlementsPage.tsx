import { useParams, Link } from 'react-router';
import { useBalances, useSettlements, useSettleDebt, useCreateSettlement } from '@/hooks/useSettlements';
import { useTrip } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, ArrowRightLeft, CheckCircle, Clock, TrendingUp, TrendingDown, HandCoins } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export default function SettlementsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId!);
  const { data: balances, isLoading: balLoading } = useBalances(tripId!);
  const { data: settlements, isLoading: setLoading } = useSettlements(tripId!);
  const settle = useSettleDebt(tripId!);
  const createSettlement = useCreateSettlement(tripId!);

  // Settle-up dialog state
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/trips/${tripId}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Settlements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{trip?.name}</p>
        </div>
      </div>

      {/* Summary cards */}
      {balances && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold mt-1">{balances.totalExpenses}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Settled</p>
              <p className="text-2xl font-bold mt-1">{balances.totalSettled}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Net Balances */}
      {balances?.balances && balances.balances.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Net Balances</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {balances.balances.map((b) => (
              <Card key={b.user.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {b.user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{b.user.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {b.amount >= 0
                      ? <TrendingUp className="h-4 w-4 text-green-500" />
                      : <TrendingDown className="h-4 w-4 text-destructive" />
                    }
                    <span className={cn(
                      'text-sm font-bold',
                      b.amount >= 0 ? 'text-green-600' : 'text-destructive'
                    )}>
                      {b.amount >= 0 ? '+' : ''}{currency} {Math.abs(b.amount).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

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
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-xs font-semibold">
                        {d.from.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">
                          {d.from.name}
                          <span className="text-muted-foreground font-normal mx-2">owes</span>
                          {d.to.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">
                        {currency} {d.amount.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSettleDialog({
                          open: true,
                          from: d.from,
                          to: d.to,
                          amount: d.amount,
                        })}
                      >
                        <HandCoins className="h-3.5 w-3.5 mr-1.5" /> Settle Up
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* No debts empty state */}
      {balances && balances.simplifiedDebts.length === 0 && balances.totalExpenses > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold">All settled up!</p>
            <p className="text-sm text-muted-foreground mt-1">Everyone is square on this trip.</p>
          </CardContent>
        </Card>
      )}

      {/* Settlement History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Settlement History</h2>
        {!settlements || settlements.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No settlements recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {settlements.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div className="flex items-center gap-3">
                    {s.status === 'SETTLED' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {s.fromUser?.name} → {s.toUser?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString()}
                        {s.note && ` · ${s.note}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-8 sm:ml-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{s.currency} {s.amount.toFixed(2)}</p>
                      <Badge variant={s.status === 'SETTLED' ? 'outline' : 'secondary'} className="text-[10px]">
                        {s.status}
                      </Badge>
                    </div>
                    {s.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => settle.mutate(s.id)}
                        disabled={settle.isPending}
                      >
                        {settle.isPending ? 'Saving...' : 'Mark Settled'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Settle Up Dialog */}
      <Dialog open={!!settleDialog} onOpenChange={(open) => { if (!open) { setSettleDialog(null); setSettleNote(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle Up</DialogTitle>
            <DialogDescription>
              Record a payment between members. This creates a pending settlement that can be confirmed by either party.
            </DialogDescription>
          </DialogHeader>
          {settleDialog && (
            <div className="space-y-4 pt-2">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-xs font-semibold">
                        {settleDialog.from.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{settleDialog.from.name}</span>
                    </div>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{settleDialog.to.name}</span>
                      <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 text-xs font-semibold">
                        {settleDialog.to.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-2xl font-bold mt-3">
                    {currency} {settleDialog.amount.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <div>
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="e.g. Paid via Venmo, bank transfer..."
                  className="mt-1.5"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => { setSettleDialog(null); setSettleNote(''); }}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleInitiateSettlement} disabled={createSettlement.isPending}>
                  {createSettlement.isPending ? 'Creating...' : 'Record Payment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
