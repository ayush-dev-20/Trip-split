import { Link } from 'react-router';
import { useGroups, useCreateGroup, useJoinGroup, useUpdateGroup, useDeleteGroup } from '@/hooks/useGroups';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { Users, Plus, UserPlus, Map, Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Group } from '@/types';

export default function GroupsPage() {
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

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

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDescription(group.description ?? '');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    updateGroup.mutate(
      { id: editingGroup.id, name: editName, description: editDescription || undefined },
      { onSuccess: () => setEditingGroup(null) }
    );
  };

  const groupPendingDelete = groups?.find((g) => g.id === deleteGroupId) ?? null;

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
              <Card className="hover:shadow-card-hover transition-shadow h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <Link to={`/groups/${group.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        {group.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{group.description}</p>
                        )}
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(group)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteGroupId(group.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Link to={`/groups/${group.id}`} className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {group._count?.members ?? 0} members
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Map className="h-3.5 w-3.5" />
                      {group._count?.trips ?? 0} trips
                    </span>
                  </Link>
                </CardContent>
              </Card>
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

      {/* Edit */}
      <Modal open={!!editingGroup} onClose={() => setEditingGroup(null)} title="Edit Group">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">Group Name <span className="text-destructive">*</span></Label>
            <Input
              id="edit-group-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. College Friends"
              required
              autoFocus
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-desc">Description</Label>
            <Textarea
              id="edit-group-desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional description"
              className="min-h-[80px] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setEditingGroup(null)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={updateGroup.isPending || !editName.trim()} className="flex-1">
              {updateGroup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {updateGroup.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={(open) => !open && setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              "{groupPendingDelete?.name}" and all associated data — trips, expenses, and members — will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteGroupId) return;
                deleteGroup.mutate(deleteGroupId, { onSuccess: () => setDeleteGroupId(null) });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
