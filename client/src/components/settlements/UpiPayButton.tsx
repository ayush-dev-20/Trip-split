import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IndianRupee } from 'lucide-react';
import { formatMoney } from '@/lib/format';

interface UpiPayButtonProps {
  payee: { id: string; name: string; upiId?: string | null };
  amount: number;
  currency: string;
  contextName: string; // trip or group name, used as transaction note
  onRecorded?: () => void; // e.g. create/mark settlement after paying
}

function buildUpiUri({ payee, amount, currency, contextName }: UpiPayButtonProps): string {
  const params: Record<string, string> = {
    pa: payee.upiId ?? '',
    pn: payee.name,
    tn: contextName,
    cu: 'INR',
  };
  // UPI supports INR only — for other currencies the payer enters the amount manually.
  if (currency === 'INR') params.am = amount.toFixed(2);
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `upi://pay?${query}`;
}

export default function UpiPayButton(props: UpiPayButtonProps) {
  const { payee, amount, currency, onRecorded } = props;
  const [open, setOpen] = useState(false);

  if (!payee.upiId) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button size="sm" variant="outline" disabled>
              <IndianRupee className="h-3.5 w-3.5" /> UPI
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Ask {payee.name} to add their UPI ID in Settings</TooltipContent>
      </Tooltip>
    );
  }

  const uri = buildUpiUri(props);
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const handleClick = () => {
    if (isTouch) {
      window.location.href = uri; // opens the UPI app chooser
    }
    setOpen(true); // desktop: QR; mobile: fallback + confirm step
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleClick}>
        <IndianRupee className="h-3.5 w-3.5" /> Pay via UPI
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay {payee.name}</DialogTitle>
            <DialogDescription>
              {currency === 'INR'
                ? <>Scan with any UPI app to pay {formatMoney(amount, currency)}.</>
                : <>UPI transfers are INR-only. Enter the equivalent of {formatMoney(amount, currency)} in your UPI app.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={uri} size={192} />
            </div>
            <p className="text-xs text-muted-foreground">{payee.upiId}</p>
          </div>
          {onRecorded && (
            <Button className="w-full" onClick={() => { setOpen(false); onRecorded(); }}>
              I've paid — record it
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
