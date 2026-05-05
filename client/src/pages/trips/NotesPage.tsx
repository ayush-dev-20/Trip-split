import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Undo,
  Redo,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useNotes, useCreateNote, useUpdateNote, useTogglePin, useDeleteNote } from '@/hooks/useNotes';
import { useAuthStore } from '@/stores/authStore';
import type { TripNote } from '@/types';

const lowlight = createLowlight();

// ── Toolbar ──────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b bg-muted/30">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title="Task list"
      >
        <CheckSquare className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code block"
      >
        <Code className="h-3.5 w-3.5 opacity-70" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="flex-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

// ── Editor pane ───────────────────────────────────────────────────────────────

function NoteEditor({
  note,
  tripId,
  onClose,
}: {
  note: TripNote;
  tripId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate: updateNote } = useUpdateNote(tripId);

  const scheduleAutoSave = useCallback(
    (payload: { title?: string; content?: string }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateNote({ noteId: note.id, ...payload });
      }, 1000);
    },
    [note.id, updateNote]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: 'Write something…' }),
    ],
    content: note.content || '',
    onUpdate: ({ editor }) => {
      scheduleAutoSave({ content: editor.getHTML() });
    },
  });

  // Flush auto-save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (editor) {
          updateNote({ noteId: note.id, title, content: editor.getHTML() });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTitleBlur() {
    if (title !== note.title) {
      updateNote({ noteId: note.id, title });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden">
          ← Back
        </Button>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleAutoSave({ title: e.target.value });
          }}
          onBlur={handleTitleBlur}
          className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
          placeholder="Note title"
        />
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor body */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-4 py-4 prose prose-sm dark:prose-invert max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
      />
    </div>
  );
}

// ── Note list item ────────────────────────────────────────────────────────────

function NoteListItem({
  note,
  isActive,
  onSelect,
  onPin,
  onDelete,
}: {
  note: TripNote;
  isActive: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const preview = note.content
    ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
    : 'No content';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={cn(
        'group relative flex flex-col gap-1 px-3 py-3 rounded-lg cursor-pointer transition-colors border',
        isActive
          ? 'bg-primary/10 border-primary/30'
          : 'hover:bg-accent border-transparent hover:border-border'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm truncate flex-1">{note.title}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
            title={note.isPinned ? 'Unpin' : 'Pin'}
          >
            {note.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {note.isPinned && (
        <Pin className="absolute top-2 right-2 h-2.5 w-2.5 text-primary opacity-60" />
      )}
      <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>
      <span className="text-[10px] text-muted-foreground/60">
        {new Date(note.updatedAt).toLocaleDateString()}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const user = useAuthStore((s) => s.user);

  const { data: notes = [], isLoading } = useNotes(tripId!);
  const { mutate: createNote, isPending: creating } = useCreateNote(tripId!);
  const { mutate: togglePin } = useTogglePin(tripId!);
  const { mutate: deleteNote } = useDeleteNote(tripId!);

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false); // mobile: show editor panel
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  function handleCreate() {
    if (!newTitle.trim()) return;
    createNote(
      { title: newTitle.trim() },
      {
        onSuccess: (note) => {
          setActiveNoteId(note.id);
          setShowEditor(true);
          setNewTitle('');
          setShowNewForm(false);
        },
      }
    );
  }

  function handleSelectNote(id: string) {
    setActiveNoteId(id);
    setShowEditor(true);
  }

  function handleDelete(noteId: string) {
    deleteNote(noteId, {
      onSuccess: () => {
        if (activeNoteId === noteId) {
          setActiveNoteId(null);
          setShowEditor(false);
        }
      },
    });
    setDeleteTarget(null);
  }

  const myNotes = notes.filter((n) => n.userId === user?.id);
  const otherNotes = notes.filter((n) => n.userId !== user?.id);

  return (
    <div className="flex h-[calc(100vh-3.5rem-4rem)] lg:h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-4 lg:-my-8 overflow-hidden">

      {/* ── Sidebar / Note list ─────────────────────────────── */}
      <div
        className={cn(
          'flex flex-col w-full lg:w-72 xl:w-80 border-r bg-background shrink-0',
          showEditor ? 'hidden lg:flex' : 'flex'
        )}
      >
        {/* List header */}
        <div className="flex flex-col border-b">
          <div className="flex items-center px-4 py-2 border-b">
            <Button variant="ghost" size="sm" className="h-8 px-2 -ml-1 text-muted-foreground hover:text-foreground" asChild>
              <Link to={`/trips/${tripId}`}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Trip
              </Link>
            </Button>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="font-semibold text-sm">Notes</h2>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
        </div>

        {/* New note form */}
        {showNewForm && (
          <div className="px-3 pt-3 pb-2 border-b">
            <Input
              autoFocus
              placeholder="Note title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setShowNewForm(false); setNewTitle(''); }
              }}
              className="text-sm h-8"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim() || creating} className="h-7 text-xs">
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNewForm(false); setNewTitle(''); }} className="h-7 text-xs">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Note list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && (
            <>
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </>
          )}

          {!isLoading && notes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">No notes yet</p>
            </div>
          )}

          {myNotes.length > 0 && (
            <>
              {myNotes.length < notes.length && (
                <p className="px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-1">My Notes</p>
              )}
              {myNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  onSelect={() => handleSelectNote(note.id)}
                  onPin={() => togglePin(note.id)}
                  onDelete={() => setDeleteTarget(note.id)}
                />
              ))}
            </>
          )}

          {otherNotes.length > 0 && (
            <>
              <p className="px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-2">From Teammates</p>
              {otherNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  onSelect={() => handleSelectNote(note.id)}
                  onPin={() => togglePin(note.id)}
                  onDelete={() => setDeleteTarget(note.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Editor pane ────────────────────────────────────── */}
      <div
        className={cn(
          'flex-1 overflow-hidden',
          !showEditor && !activeNote ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
        )}
      >
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            tripId={tripId!}
            onClose={() => { setShowEditor(false); }}
          />
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a note or create a new one</p>
            <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Note
            </Button>
          </div>
        )}
      </div>

      {/* ── Delete confirmation ──────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
