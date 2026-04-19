import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTrips, useDeleteTrip } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Map, Plus, MapPin, Users, Calendar, Search, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { TripStatus } from '@/types';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_TABS: { label: string; value: TripStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  UPCOMING: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ARCHIVED: 'secondary',
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trips</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track all your travel expenses
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/trips/new">
            <Plus className="h-4 w-4 mr-2" /> New Trip
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trips..."
            className="pl-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TripStatus | 'ALL')}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
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
          icon={<Map className="h-8 w-8" />}
          title="No trips found"
          description={search ? 'Try adjusting your search' : 'Create your first trip to start tracking expenses'}
          action={
            !search && (
              <Button asChild>
                <Link to="/trips/new">
                  <Plus className="h-4 w-4 mr-2" /> Create Trip
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip, i) => (
            <motion.div
              key={trip.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="hover:shadow-md transition-all group">
                <CardContent className="p-5">
                  {trip.coverImageUrl && (
                    <img
                      src={trip.coverImageUrl}
                      alt={trip.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                    />
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <Link to={`/trips/${trip.id}`} className="flex-1 min-w-0">
                      <h3 className="font-semibold group-hover:text-primary transition-colors truncate">
                        {trip.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <Badge variant={statusVariant[trip.status] ?? 'secondary'} className="text-[10px]">
                        {trip.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
                  </div>
                  <Link to={`/trips/${trip.id}`}>
                    {trip.destination && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                        <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                      </p>
                    )}
                    {trip.description && (
                      <p className="text-sm text-muted-foreground/70 line-clamp-2 mb-3">
                        {trip.description}
                      </p>
                    )}
                    <Separator className="mb-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {trip._count?.members ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        {trip._count?.expenses ?? 0} expenses
                      </span>
                      {trip.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

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
