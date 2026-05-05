import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, QrCode, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface QRCodeShareProps {
  title: string;
  inviteCode: string;
  deepLink: string; // full URL e.g. https://tripsplit.app/join/ABC123
  trigger?: React.ReactNode;
}

export default function QRCodeShare({ title, inviteCode, deepLink, trigger }: QRCodeShareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, deepLink, {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(() => {});
    }
  }, [deepLink]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `tripsplit-invite-${inviteCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-2" />
            Share QR
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 pt-2">
          {/* QR canvas */}
          <div className="rounded-xl border border-border p-3 bg-white">
            <canvas ref={canvasRef} />
          </div>

          {/* Invite code badge */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Invite code</p>
            <span className="font-mono font-bold text-lg tracking-widest text-primary">
              {inviteCode}
            </span>
          </div>

          {/* Copyable link */}
          <div className="w-full flex gap-2">
            <Input
              value={deepLink}
              readOnly
              className="text-xs font-mono bg-muted"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex-shrink-0">
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
