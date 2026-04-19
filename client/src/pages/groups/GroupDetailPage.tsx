import { useParams, Link, useNavigate } from 'react-router';
import { useGroup, useDeleteGroup } from '@/hooks/useGroups';
import { useTrips } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, Users, Map, Plus, Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/groups')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            {group.description && <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Invite Code */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Invite Code</p>
            <p className="text-lg font-mono font-semibold">{group.inviteCode}</p>
          </div>
          <Button variant="secondary" onClick={copyCode} className="w-full sm:w-auto">
            <Copy className="h-4 w-4 mr-2" /> {copied ? 'Copied!' : 'Copy'}
          </Button>
        </CardContent>
      </Card>

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Members ({group.members?.length ?? 0})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {group.members?.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {m.user?.name?.charAt(0) ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                </div>
                {m.role === 'ADMIN' && <Badge variant="secondary" className="text-[10px] ml-auto">Admin</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Group Trips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Trips</h2>
          <Button asChild size="sm">
            <Link to="/trips/new"><Plus className="h-4 w-4 mr-2" /> New Trip</Link>
          </Button>
        </div>
        {trips.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Map className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No trips in this group yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <h3 className="font-medium">{trip.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {trip._count?.members ?? 0}</span>
                      <span>{trip.status}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
