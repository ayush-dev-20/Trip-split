import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Luggage, Sparkles, Loader2, Plus, Trash2, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EmptyState from '@/components/ui/EmptyState';
import { useTrip } from '@/hooks/useTrips';
import {
  usePackingItems, useGeneratePackingItems, useAddPackingItem,
  useTogglePackingItem, useUpdatePackingItem, useDeletePackingItem, useClearPackingItems,
} from '@/hooks/usePackingItems';
import { cn } from '@/lib/utils';
import type { PackingItem } from '@/types';

export default function PackingListPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId!);

  const { data: items = [], isLoading } = usePackingItems(tripId!);
  const generate = useGeneratePackingItems(tripId!);
  const addItem = useAddPackingItem(tripId!);
  const toggleItem = useTogglePackingItem(tripId!);
  const updateItem = useUpdatePackingItem(tripId!);
  const deleteItem = useDeletePackingItem(tripId!);
  const clearAll = useClearPackingItems(tripId!);

  const [newItem, setNewItem] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Group items by category, preserving each category's own sort order
  const grouped = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [items]);

  const packedCount = items.filter((i) => i.isPacked).length;
  const progress = items.length > 0 ? Math.round((packedCount / items.length) * 100) : 0;

  const handleGenerate = () => {
    setGenerateError(null);
    generate.mutate(undefined, {
      onError: (err) => {
        const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
        setGenerateError(
          code === 'NO_DESTINATION'
            ? 'This trip has no destination set — add one to generate a packing list.'
            : 'Could not generate a packing list right now. Please try again.'
        );
      },
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItem.trim();
    if (!name || addItem.isPending) return;
    addItem.mutate({ name }, { onSuccess: () => setNewItem('') });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="h-8 px-2 -ml-1 text-muted-foreground hover:text-foreground" asChild>
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Trip
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-info/15 text-primary shrink-0">
              <Luggage className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight">Packing List</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {trip?.destination ? `For ${trip.destination}` : trip?.name ?? 'For this trip'}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmClearOpen(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              aria-label="Clear packing list"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {items.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                {packedCount} of {items.length} packed
              </p>
              <span className="text-sm font-semibold tabular-nums text-primary">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {generateError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{generateError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Luggage className="h-7 w-7" />}
          title="No packing list yet"
          description="Generate one from this trip's destination and dates, or add items yourself below."
          action={
            <Button onClick={handleGenerate} disabled={generate.isPending}>
              {generate.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                : <><Sparkles className="h-4 w-4" /> Generate with AI</>}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 items-start">
          {grouped.map(([category, categoryItems]) => (
            <CategoryCard
              key={category}
              category={category}
              items={categoryItems}
              onToggle={(item) => toggleItem.mutate({ id: item.id, isPacked: !item.isPacked })}
              onRename={(item, name) => updateItem.mutate({ id: item.id, name })}
              onDelete={(item) => deleteItem.mutate(item.id)}
              onAdd={(name) => addItem.mutate({ name, category })}
              isAdding={addItem.isPending}
            />
          ))}
        </div>
      )}

      {/* Quick-add composer — stays pinned above the mobile nav while the list scrolls */}
      <div className="sticky bottom-16 lg:bottom-2 z-30 pt-1">
        <Card className="shadow-lg">
          <CardContent className="p-3 space-y-2">
            <form onSubmit={handleAddItem} className="flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add an item to Other…"
                className="flex-1"
              />
              <Button type="submit" disabled={!newItem.trim() || addItem.isPending}>
                {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </form>

            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generate.isPending} className="w-full">
                {generate.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                  : <><Sparkles className="h-3.5 w-3.5" /> Suggest more with AI</>}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear packing list?</AlertDialogTitle>
            <AlertDialogDescription>
              All {items.length} item{items.length !== 1 ? 's' : ''} will be permanently deleted, including the ones you've already packed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { clearAll.mutate(); setConfirmClearOpen(false); }}
            >
              Clear list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({
  category, items, onToggle, onRename, onDelete, onAdd, isAdding,
}: {
  category: string;
  items: PackingItem[];
  onToggle: (item: PackingItem) => void;
  onRename: (item: PackingItem, name: string) => void;
  onDelete: (item: PackingItem) => void;
  onAdd: (name: string) => void;
  isAdding: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addOpen) addInputRef.current?.focus();
  }, [addOpen]);

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || isAdding) return;
    onAdd(name);
    setDraft('');
    // Keep the field open and focused so several items can be added in a row
    addInputRef.current?.focus();
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm font-semibold">{category}</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {items.filter((i) => i.isPacked).length}/{items.length}
          </span>
        </div>

        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <PackingRow
                key={item.id}
                item={item}
                onToggle={() => onToggle(item)}
                onRename={(name) => onRename(item, name)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </AnimatePresence>
        </ul>

        {addOpen ? (
          <form onSubmit={submitAdd} className="flex gap-1.5 mt-2.5">
            <Input
              ref={addInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { if (!draft.trim()) setAddOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(''); setAddOpen(false); } }}
              placeholder={`Add to ${category}…`}
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" className="h-8 shrink-0" disabled={!draft.trim() || isAdding}>
              {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Single item row ───────────────────────────────────────────────────────────

function PackingRow({
  item, onToggle, onRename, onDelete,
}: {
  item: PackingItem;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== item.name) onRename(name);
    else setDraft(item.name); // empty or unchanged — restore the original
    setEditing(false);
  };

  const cancel = () => {
    setDraft(item.name);
    setEditing(false);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2.5 group"
    >
      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); commit(); }}
          className="flex-1 min-w-0"
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
            className="h-7 text-sm"
          />
        </form>
      ) : (
        <>
          <input
            id={`packing-${item.id}`}
            type="checkbox"
            checked={item.isPacked}
            onChange={onToggle}
            className="h-4 w-4 rounded border-border accent-primary shrink-0 cursor-pointer"
          />
          <label
            htmlFor={`packing-${item.id}`}
            className={cn(
              'text-sm flex-1 min-w-0 cursor-pointer py-0.5',
              item.isPacked && 'line-through text-muted-foreground',
            )}
          >
            {item.name}
          </label>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
            aria-label={`Rename ${item.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
            aria-label={`Remove ${item.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </motion.li>
  );
}
