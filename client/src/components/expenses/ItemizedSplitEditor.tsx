import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import UserAvatar from '@/components/ui/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import type { ItemizedReceipt, ExpenseItem } from '@/types';

interface Member { id: string; name: string }

interface ItemizedSplitEditorProps {
  receipt: ItemizedReceipt;
  members: Member[];
  onChange: (result: { perUser: { userId: string; owedAmount: number }[]; items: ExpenseItem[] }) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure: assignments → per-user owed totals. Exported for reuse/inspection. */
export function computeOwedTotals(
  receipt: ItemizedReceipt,
  items: ExpenseItem[],
  members: Member[]
): { userId: string; owedAmount: number }[] {
  const claimed = new Map<string, number>(members.map((m) => [m.id, 0]));
  for (const item of items) {
    const claimants = item.assignedTo?.length ? item.assignedTo : members.map((m) => m.id);
    const each = item.totalPrice / claimants.length;
    for (const id of claimants) claimed.set(id, (claimed.get(id) ?? 0) + each);
  }
  const claimedTotal = [...claimed.values()].reduce((a, b) => a + b, 0) || 1;
  const overhead = receipt.tax + receipt.serviceCharge;

  const totals = members.map((m) => {
    const c = claimed.get(m.id) ?? 0;
    return { userId: m.id, owedAmount: round2(c + (c / claimedTotal) * overhead) };
  });
  // Force exact total: dump rounding drift on the largest share.
  const drift = round2(receipt.total - totals.reduce((s, t) => s + t.owedAmount, 0));
  if (Math.abs(drift) >= 0.01 && totals.length > 0) {
    const largest = totals.reduce((a, b) => (b.owedAmount > a.owedAmount ? b : a));
    largest.owedAmount = round2(largest.owedAmount + drift);
  }
  return totals;
}

export default function ItemizedSplitEditor({ receipt, members, onChange }: ItemizedSplitEditorProps) {
  const [items, setItems] = useState<ExpenseItem[]>(receipt.items.map((i) => ({ ...i, assignedTo: [] })));

  const totals = useMemo(() => computeOwedTotals(receipt, items, members), [receipt, items, members]);

  useEffect(() => {
    onChange({ perUser: totals, items });
  }, [totals, items, onChange]);

  const toggle = (itemIdx: number, userId: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const cur = item.assignedTo ?? [];
        return { ...item, assignedTo: cur.includes(userId) ? cur.filter((u) => u !== userId) : [...cur, userId] };
      })
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Who had what?</p>
          <Badge variant="secondary" className="text-[10px]">Unclaimed items are shared by everyone</Badge>
        </div>
        <ul className="divide-y">
          {items.map((item, idx) => (
            <li key={idx} className="py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm truncate', item.isAdjustment && 'text-muted-foreground italic')}>
                  {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(item.totalPrice, receipt.currency)}</p>
              </div>
              <div className="flex gap-1">
                {members.map((m) => {
                  const on = item.assignedTo?.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(idx, m.id)}
                      className={cn('rounded-full transition-opacity', on ? 'opacity-100 ring-2 ring-primary' : 'opacity-40')}
                      aria-pressed={on}
                      aria-label={`Assign ${item.name} to ${m.name}`}
                    >
                      <UserAvatar name={m.name} size="sm" />
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t pt-2 space-y-1">
          {totals.map((t) => {
            const m = members.find((x) => x.id === t.userId);
            return (
              <div key={t.userId} className="flex justify-between text-xs">
                <span>{m?.name}</span>
                <span className="tabular-nums font-medium">{formatMoney(t.owedAmount, receipt.currency)}</span>
              </div>
            );
          })}
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>Receipt total (incl. tax & charges)</span>
            <span className="tabular-nums">{formatMoney(receipt.total, receipt.currency)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
