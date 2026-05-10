import { Link } from 'react-router';
import { useGroups, useCreateGroup, useJoinGroup } from '@/hooks/useGroups';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { Users, Plus, UserPlus, Map, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function GroupsPage() {
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

  if (isLoading) return <PageLoader />;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createGroup.mutate(
      { name, description: description || undefined },
      { onSuccess: () => { setShowCreate(false); setName(''); setDescription(''); } }
    );
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    joinGroup.mutate(joinCode, { onSuccess: () => { setShowJoin(false); setJoinCode(''); } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Organize your travel companions"
        actions={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={() => setShowJoin(true)}>
              <UserPlus className="h-4 w-4" /> Join
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Group
            </Button>
          </div>
        }
      />

      {!groups || groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="No groups yet"
          description="Create a group to organize trips with the same travel buddies."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowJoin(true)}>
                <UserPlus className="h-4 w-4" /> Join with Code
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Create Group
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.2) }}
            >
              <Link to={`/groups/${group.id}`} className="block h-full">
                <Card className="hover:shadow-card-hover transition-shadow h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        {group.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {group._count?.members ?? 0} members
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Map className="h-3.5 w-3.5" />
                        {group._count?.trips ?? 0} trips
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Mobile actions */}
      <div className="flex gap-2 sm:hidden">
        <Button variant="outline" onClick={() => setShowJoin(true)} className="flex-1">
          <UserPlus className="h-4 w-4" /> Join
        </Button>
        <Button onClick={() => setShowCreate(true)} className="flex-1">
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {/* Create */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Group">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name <span className="text-destructive">*</span></Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. College Friends"
              required
              autoFocus
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-desc">Description</Label>
            <Textarea
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="min-h-[80px] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={createGroup.isPending || !name.trim()} className="flex-1">
              {createGroup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createGroup.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Group">
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-code">Invite Code <span className="text-destructive">*</span></Label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter invite code"
              required
              autoFocus
              className="h-10 font-mono"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowJoin(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={joinGroup.isPending || !joinCode.trim()} className="flex-1">
              {joinGroup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {joinGroup.isPending ? 'Joining…' : 'Join Group'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
