import { Card, CardContent } from '@/components/ui/card';
import UserAvatar from '@/components/ui/UserAvatar';
import { Crown } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TripBalances } from '@/types';

interface WhoPaysNextCardProps {
  balances: TripBalances;
  currency: string;
  currentUserId?: string;
}

export default function WhoPaysNextCard({ balances, currency, currentUserId }: WhoPaysNextCardProps) {
  const next = balances.whoPaysNext;
  if (!next?.user) return null;

  const ranked = [...balances.balances]
    .filter((b) => b.amount < -0.01)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 4);
  const isMe = next.user.id === currentUserId;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <UserAvatar name={next.user.name} size="md" />
            <Crown className="absolute -top-2 -right-1.5 h-4 w-4 text-warning rotate-12" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {isMe ? 'You should pay next' : `${next.user.name} should pay next`}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatMoney(Math.abs(next.amount), currency)} behind the group
            </p>
          </div>
        </div>
        {ranked.length > 1 && (
          <ul className="mt-3 space-y-1.5">
            {ranked.map((b, i) => (
              <li key={b.user.id} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className={cn('flex-1 truncate', i === 0 && 'font-medium')}>
                  {b.user.name}
                  {b.user.id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                </span>
                <span className="tabular-nums text-destructive">
                  {formatMoney(Math.abs(b.amount), currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
