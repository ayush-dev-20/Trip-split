import { useParams, Link, useNavigate } from 'react-router';
import { useGroup, useDeleteGroup } from '@/hooks/useGroups';
import { useTrips } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import SectionHeading from '@/components/ui/SectionHeading';
import EmptyState from '@/components/ui/EmptyState';
import UserAvatar from '@/components/ui/UserAvatar';
import { Users, Map, Plus, Copy, Trash2, Loader2, Check, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { data: group, isLoading } = useGroup(groupId!);
  const { data: tripsData } = useTrips({ groupId });
  const deleteGroup = useDeleteGroup();
  const [copied, setCopied] = useState(false);

  if (isLoading || !group) return <PageLoader />;

  const trips = tripsData?.trips ?? [];

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this group? All associated data will be removed.')) {
      deleteGroup.mutate(groupId!, { onSuccess: () => navigate('/groups') });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={group.name}
        description={group.description}
        back="/groups"
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleteGroup.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete group"
          >
            {deleteGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        }
      />

      {/* Invite Code */}
      <Card className="bg-gradient-to-br from-primary/5 to-info/5 border-primary/10">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Invite Code</p>
            <p className="text-xl sm:text-2xl font-mono font-bold mt-0.5 tracking-wide">{group.inviteCode}</p>
          </div>
          <Button variant={copied ? 'success' : 'default'} onClick={copyCode}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
        </CardContent>
      </Card>

      {/* Members */}
      <section>
        <SectionHeading title={`Members (${group.members?.length ?? 0})`} />
        <div className="grid gap-2 sm:grid-cols-2">
          {group.members?.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <UserAvatar name={m.user?.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.user?.email}</p>
                </div>
                {m.role === 'ADMIN' && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">Admin</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trips */}
      <section>
        <SectionHeading
          title="Trips"
          action={
            <Button asChild size="sm">
              <Link to="/trips/new">
                <Plus className="h-4 w-4" /> New Trip
              </Link>
            </Button>
          }
        />
        {trips.length === 0 ? (
          <EmptyState
            icon={<Map className="h-7 w-7" />}
            title="No trips yet"
            description="Create the first trip for this group."
            action={
              <Button asChild>
                <Link to="/trips/new">
                  <Plus className="h-4 w-4" /> Create Trip
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`}>
                <Card className="hover:shadow-card-hover transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm flex-1 truncate">{trip.name}</h3>
                      <Badge variant="outline" className={cn(
                        'text-[10px] shrink-0',
                        trip.status === 'ACTIVE' && 'bg-success/10 text-success border-success/20',
                        trip.status === 'UPCOMING' && 'bg-info/10 text-info border-info/20',
                      )}>
                        {trip.status}
                      </Badge>
                    </div>
                    {trip.destination && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3" />
                        {trip.destination}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {trip._count?.members ?? 0}
                      </span>
                      <span>{trip._count?.expenses ?? 0} expenses</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
