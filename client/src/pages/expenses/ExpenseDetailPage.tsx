import { useParams, useNavigate } from 'react-router';
import { useExpense, useDeleteExpense, useAddComment, useAddReaction } from '@/hooks/useExpenses';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import UserAvatar from '@/components/ui/UserAvatar';
import { Trash2, MessageCircle, Send, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCategoryStyle } from '@/lib/categoryStyle';
import AIChatPanel from '@/components/ui/AIChatPanel';
import { aiService } from '@/services/aiService';
import { formatMoney, formatDate, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '💸', '🎉'];

const SPLIT_LABEL: Record<string, string> = {
  EQUAL: 'Split equally',
  PERCENTAGE: 'Percentage split',
  EXACT: 'Exact amounts',
  SHARES: 'Shares-based',
};

export default function ExpenseDetailPage() {
  const { tripId, expenseId } = useParams<{ tripId: string; expenseId: string }>();
  const navigate = useNavigate();
  const { data: expense, isLoading } = useExpense(tripId!, expenseId!);
  const deleteExpense = useDeleteExpense(tripId!);
  const addComment = useAddComment(tripId!, expenseId!);
  const addReaction = useAddReaction(tripId!, expenseId!);
  const [comment, setComment] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (isLoading || !expense) return <PageLoader />;

  const cat = getCategoryStyle(expense.category);
  const Icon = cat.icon;

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate(comment, { onSuccess: () => setComment('') });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        title={expense.title}
        description={formatDate(expense.date, { withYear: true })}
        back={`/trips/${tripId}/expenses`}
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleteExpense.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete expense"
          >
            {deleteExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        }
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              "{expense.title}" will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteExpense.mutate(expenseId!, { onSuccess: () => navigate(`/trips/${tripId}/expenses`) })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hero amount card */}
      <Card>
        <CardContent className="p-6 sm:p-8 text-center">
          <div className={cn('inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4', cat.bg)}>
            <Icon className={cn('h-7 w-7', cat.fg)} />
          </div>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
            {formatMoney(expense.amount, expense.currency)}
          </p>
          {expense.convertedAmount && expense.convertedAmount !== expense.amount && (
            <p className="text-sm text-muted-foreground mt-1 tabular-nums">
              ≈ {formatMoney(expense.convertedAmount, expense.currency)}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant="outline" className={cn(cat.bg, cat.fg, 'border-transparent')}>
              {cat.label}
            </Badge>
            <Badge variant="secondary">{SPLIT_LABEL[expense.splitType] ?? expense.splitType}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Paid by</span>
            <div className="flex items-center gap-2">
              <UserAvatar name={expense.paidBy?.name} size="xs" />
              <span className="font-medium">{expense.paidBy?.name}</span>
            </div>
          </div>
          {expense.description && (
            <>
              <div className="border-t" />
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Notes</p>
                <p className="leading-relaxed whitespace-pre-wrap">{expense.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Splits */}
      {expense.splits && expense.splits.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 px-1">Split Details</h2>
          <Card>
            <ul className="divide-y">
              {expense.splits.map((split) => {
                const pct = expense.amount > 0 ? (split.amount / expense.amount) * 100 : 0;
                return (
                  <li key={split.id} className="px-4 py-3 flex items-center gap-3">
                    <UserAvatar name={split.user?.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{split.user?.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {pct.toFixed(0)}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMoney(split.amount, expense.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {/* Items */}
      {expense.items && expense.items.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 px-1">Items</h2>
          <Card>
            <ul className="divide-y">
              {expense.items.map((item, idx) => {
                const claimants = (item.assignedTo ?? [])
                  .map((id) => expense.splits?.find((s) => s.userId === id)?.user?.name)
                  .filter((n): n is string => !!n);
                return (
                  <li key={idx} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', item.isAdjustment && 'text-muted-foreground italic font-normal')}>
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {claimants.length > 0 ? claimants.join(', ') : 'Shared'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMoney(item.totalPrice, expense.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {/* Reactions */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 px-1">React</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_REACTIONS.map((emoji) => {
            const count = expense.reactions?.filter((r) => r.emoji === emoji).length ?? 0;
            return (
              <button
                key={emoji}
                onClick={() => addReaction.mutate(emoji)}
                disabled={addReaction.isPending}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition-all disabled:opacity-60 active:scale-95',
                  count > 0
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-border bg-background hover:border-muted-foreground/40 hover:bg-accent'
                )}
              >
                <span className="text-base leading-none">{emoji}</span>
                {count > 0 && <span className="text-xs font-medium tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comments */}
      <div>
        <h2 className="text-base font-semibold mb-3 px-1 flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Comments
          {expense.comments && expense.comments.length > 0 && (
            <span className="text-muted-foreground font-normal">({expense.comments.length})</span>
          )}
        </h2>

        {expense.comments && expense.comments.length > 0 && (
          <Card className="mb-3">
            <ul className="divide-y">
              {expense.comments.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  className="flex gap-3 px-4 py-3"
                >
                  <UserAvatar name={c.user?.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{c.user?.name}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-0.5 leading-relaxed">{c.content}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </Card>
        )}

        <form onSubmit={handleComment} className="flex gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 h-10"
          />
          <Button type="submit" disabled={addComment.isPending || !comment.trim()} size="icon" className="h-10 w-10">
            {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      {/* Ask AI */}
      <div>
        <h2 className="text-base font-semibold mb-3 px-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Ask AI
        </h2>
        <div className="h-[50vh] flex flex-col border rounded-xl overflow-hidden bg-card">
          <AIChatPanel
            mutationFn={(msg) => aiService.chatbot(tripId!, msg)}
            placeholder="Ask about this expense…"
            emptyTitle="Ask AI about this expense"
            emptySubtitle='"Who owes what?" · "Is this split fairly?"'
          />
        </div>
      </div>
    </div>
  );
}
