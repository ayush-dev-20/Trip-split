import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTrips, useDeleteTrip } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Map, Plus, MapPin, Users, Calendar, Search, MoreVertical, Pencil, Trash2, Receipt } from 'lucide-react';
import type { TripStatus } from '@/types';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatMoneyCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TABS: { label: string; value: TripStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  UPCOMING:  { label: 'Upcoming',  className: 'bg-info/10 text-info border-info/20' },
  ACTIVE:    { label: 'Active',    className: 'bg-success/10 text-success border-success/20' },
  COMPLETED: { label: 'Completed', className: 'bg-muted text-muted-foreground border-border' },
  ARCHIVED:  { label: 'Archived',  className: 'bg-muted text-muted-foreground border-border' },
};

export default function TripsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TripStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data, isLoading } = useTrips(
    statusFilter === 'ALL' ? undefined : { status: statusFilter }
  );
  const deleteTrip = useDeleteTrip();

  if (isLoading) return <PageLoader />;

  const trips = (data?.trips ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.destination?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips"
        description="Manage and track all your travel expenses"
        actions={
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/trips/new">
              <Plus className="h-4 w-4" /> New Trip
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trips or destinations..."
            className="pl-9 h-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TripStatus | 'ALL')}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="h-10">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-3 sm:px-4">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Trip list */}
      {trips.length === 0 ? (
        <EmptyState
          icon={<Map className="h-7 w-7" />}
          title={search ? 'No matches found' : 'No trips yet'}
          description={search ? 'Try a different search term.' : 'Create your first trip to start tracking expenses with friends.'}
          action={
            !search && (
              <Button asChild>
                <Link to="/trips/new">
                  <Plus className="h-4 w-4" /> Create Your First Trip
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip, i) => {
            const status = STATUS_BADGE[trip.status] ?? STATUS_BADGE.ARCHIVED;
            const spent = trip.totalSpent ?? 0;
            const budgetPct = trip.budgetAmount ? Math.min(100, (spent / trip.budgetAmount) * 100) : null;

            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card className="group overflow-hidden hover:shadow-card-hover transition-shadow h-full">
                  <Link to={`/trips/${trip.id}`} className="block">
                    {trip.coverImageUrl ? (
                      <div className="relative h-32 overflow-hidden">
                        <img
                          src={trip.coverImageUrl}
                          alt={trip.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                    ) : (
                      <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-info/10 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Map className="h-10 w-10 text-primary/40" />
                        </div>
                      </div>
                    )}
                  </Link>

                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link to={`/trips/${trip.id}`} className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                          {trip.name}
                        </h3>
                        {trip.destination && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{trip.destination}</span>
                          </p>
                        )}
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 -mr-1 -mt-1 shrink-0"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/trips/${trip.id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(trip.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Link to={`/trips/${trip.id}`} className="block">
                      {/* Status badge + dates */}
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className={cn('text-[10px] font-semibold', status.className)}>
                          {status.label}
                        </Badge>
                        {trip.startDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(trip.startDate)}
                          </span>
                        )}
                      </div>

                      {/* Budget progress */}
                      {trip.budgetAmount && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">Spent</span>
                            <span className="font-semibold tabular-nums">
                              {formatMoneyCompact(spent, trip.budgetCurrency)}
                              <span className="text-muted-foreground font-normal"> / {formatMoneyCompact(trip.budgetAmount, trip.budgetCurrency)}</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                (budgetPct ?? 0) > 90 ? 'bg-destructive' :
                                (budgetPct ?? 0) > 75 ? 'bg-warning' : 'bg-primary'
                              )}
                              style={{ width: `${budgetPct ?? 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer stats */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {trip._count?.members ?? 0} {(trip._count?.members ?? 0) === 1 ? 'member' : 'members'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Receipt className="h-3.5 w-3.5" />
                          {trip._count?.expenses ?? 0} {(trip._count?.expenses ?? 0) === 1 ? 'expense' : 'expenses'}
                        </span>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <Button
        asChild
        size="lg"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg sm:hidden z-30"
      >
        <Link to="/trips/new" aria-label="New Trip">
          <Plus className="h-6 w-6" />
        </Link>
      </Button>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Trip"
        description="Are you sure you want to delete this trip? All expenses and settlements will be permanently removed. This cannot be undone."
        confirmLabel="Delete Trip"
        loading={deleteTrip.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteTrip.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
      />
    </div>
  );
}
