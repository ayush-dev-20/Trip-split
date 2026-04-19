import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfirmationVariant = 'destructive' | 'warning' | 'default';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  loading?: boolean;
  onConfirm: () => void;
}

const variantConfig: Record<ConfirmationVariant, { icon: React.ReactNode; iconBg: string }> = {
  destructive: {
    icon: <Trash2 className="h-5 w-5 text-destructive" />,
    iconBg: 'bg-destructive/10',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    iconBg: 'bg-amber-500/10',
  },
  default: {
    icon: null,
    iconBg: '',
  },
};

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  onConfirm,
}: ConfirmationDialogProps) {
  const { icon, iconBg } = variantConfig[variant];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {icon && (
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', iconBg)}>
                {icon}
              </div>
            )}
            <div className="space-y-1">
              <DialogTitle className="leading-snug">{title}</DialogTitle>
              <DialogDescription className="text-sm">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'default' ? 'default' : 'destructive'}
            onClick={() => { onConfirm(); onOpenChange(false); }}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
