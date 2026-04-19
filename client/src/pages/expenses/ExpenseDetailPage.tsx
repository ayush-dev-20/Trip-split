import { useParams, Link, useNavigate } from 'react-router';
import { useExpense, useDeleteExpense, useAddComment, useAddReaction } from '@/hooks/useExpenses';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, Trash2, MessageCircle, Send, SmilePlus } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const categoryEmoji: Record<string, string> = {
  FOOD: '🍕', TRANSPORT: '🚗', ACCOMMODATION: '🏨', ACTIVITIES: '🎯',
  SHOPPING: '🛍️', HEALTH: '💊', COMMUNICATION: '📱', ENTERTAINMENT: '🎬',
  FEES: '💰', OTHER: '📦',
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '💸', '🎉'];

export default function ExpenseDetailPage() {
  const { tripId, expenseId } = useParams<{ tripId: string; expenseId: string }>();
  const navigate = useNavigate();
  const { data: expense, isLoading } = useExpense(tripId!, expenseId!);
  const deleteExpense = useDeleteExpense(tripId!);
  const addComment = useAddComment(tripId!, expenseId!);
  const addReaction = useAddReaction(tripId!, expenseId!);
  const [comment, setComment] = useState('');

  if (isLoading || !expense) return <PageLoader />;

  const handleDelete = () => {
    if (window.confirm('Delete this expense?')) {
      deleteExpense.mutate(expenseId!, { onSuccess: () => navigate(`/trips/${tripId}/expenses`) });
    }
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate(comment, { onSuccess: () => setComment('') });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/trips/${tripId}/expenses`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{expense.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(expense.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Amount Card */}
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-4xl mb-2">{categoryEmoji[expense.category] ?? '📦'}</div>
          <p className="text-3xl font-bold">
            {expense.currency} {expense.amount.toFixed(2)}
          </p>
          {expense.convertedAmount && expense.convertedAmount !== expense.amount && (
            <p className="text-sm text-muted-foreground mt-1">≈ converted {expense.convertedAmount.toFixed(2)}</p>
          )}
          <div className="flex items-center justify-center gap-3 mt-3 text-sm">
            <Badge variant="secondary">{expense.category}</Badge>
            <Badge variant="outline">{expense.splitType}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid by</span>
            <span className="font-medium">{expense.paidBy?.name}</span>
          </div>
          {expense.description && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Notes</span>
              <span className="text-right max-w-[60%]">{expense.description}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Splits */}
      {expense.splits && expense.splits.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Split Details</h2>
          <div className="space-y-2">
            {expense.splits.map((split) => (
              <Card key={split.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {split.user?.name?.charAt(0) ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{split.user?.name}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {expense.currency} {split.amount.toFixed(2)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reactions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_REACTIONS.map((emoji) => {
          const count = expense.reactions?.filter((r) => r.emoji === emoji).length ?? 0;
          return (
            <button
              key={emoji}
              onClick={() => addReaction.mutate(emoji)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition-colors',
                count > 0
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              {emoji} {count > 0 && <span className="text-xs font-medium">{count}</span>}
            </button>
          );
        })}
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-muted-foreground/30 text-sm">
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Comments */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> Comments ({expense.comments?.length ?? 0})
        </h2>

        {expense.comments && expense.comments.length > 0 && (
          <div className="space-y-3 mb-4">
            {expense.comments.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex gap-3"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {c.user?.name?.charAt(0) ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.user?.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <form onSubmit={handleComment} className="flex gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1"
          />
          <Button type="submit" disabled={addComment.isPending || !comment.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
