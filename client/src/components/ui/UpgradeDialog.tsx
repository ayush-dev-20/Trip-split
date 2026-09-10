import { Link } from 'react-router';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

/**
 * Shared "this is a PRO feature" paywall dialog — extracted from the pattern
 * originally built inline in CreateExpensePage.tsx for itemized receipts.
 * Every other PRO-gated action in the app should reuse this instead of
 * re-implementing the modal.
 *
 * Usage: keep a local `const [showUpgrade, setShowUpgrade] = useState(false)`
 * next to the gated action, and open it instead of performing the action
 * when `!isPro`.
 */
export default function UpgradeDialog({
  open,
  onOpenChange,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One sentence describing what's being gated, e.g. "Exporting your expenses as PDF/CSV". */
  description: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Upgrade to PRO
          </DialogTitle>
          <DialogDescription>{description} is a PRO feature. Upgrade your plan to unlock it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button asChild>
            <Link to="/settings/billing">Upgrade</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
