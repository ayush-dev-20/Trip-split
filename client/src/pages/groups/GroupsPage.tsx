import { Link } from 'react-router';
import { useGroups, useCreateGroup, useJoinGroup } from '@/hooks/useGroups';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { Users, Plus, UserPlus } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize your travel companions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowJoin(true)} className="flex-1 sm:flex-none">
            <UserPlus className="h-4 w-4 mr-2" /> Join
          </Button>
          <Button onClick={() => setShowCreate(true)} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" /> New Group
          </Button>
        </div>
      </div>

      {!groups || groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No groups yet"
          description="Create a group to start organizing your travel buddies"
          action={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" /> Create Group</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => (
            <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link to={`/groups/${group.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        {group.description && <p className="text-xs text-muted-foreground truncate">{group.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{group._count?.members ?? 0} members</span>
                      <span>{group._count?.trips ?? 0} trips</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Group">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Group Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. College Friends" required className="mt-1.5" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="mt-1.5 min-h-[80px]" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={createGroup.isPending} className="flex-1">
              {createGroup.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Group">
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <Label>Invite Code *</Label>
            <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter invite code" required className="mt-1.5" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowJoin(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={joinGroup.isPending} className="flex-1">
              {joinGroup.isPending ? 'Joining...' : 'Join Group'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
