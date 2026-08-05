import { useState } from 'react';
import { Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { verifyKioskPin } from '@/hooks/useKioskMode';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  onSuccess: () => void | Promise<void>;
}

/** Kiosk PIN so'raydigan umumiy oyna */
export default function KioskPinPrompt({
  open,
  onOpenChange,
  title = 'Kiosk PIN kodi',
  description = "Davom etish uchun kiosk PIN kodini kiriting.",
  actionLabel = 'Tasdiqlash',
  onSuccess,
}: Props) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    const ok = await verifyKioskPin(pin);
    setChecking(false);
    if (!ok) {
      toast.error("PIN kod noto'g'ri");
      setPin('');
      return;
    }
    setPin('');
    onOpenChange(false);
    await onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPin(''); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="kiosk-pin-prompt">PIN kod</Label>
          <div className="flex gap-2">
            <Input
              id="kiosk-pin-prompt"
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              className="font-mono"
              placeholder="••••"
            />
            <Button onClick={() => void submit()} disabled={!pin.trim() || checking}>
              {actionLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
