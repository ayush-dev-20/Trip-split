import { motion } from 'framer-motion';
import { TrendingUp, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import type { AnomalyAlert } from '@/stores/anomalyStore';

export default function AnomalyBanner({ anomaly, onDismiss }: { anomaly: AnomalyAlert; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {anomaly.title} — {formatMoney(anomaly.amount, anomaly.currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{anomaly.reason}</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onDismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
