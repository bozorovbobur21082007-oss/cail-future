import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
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
import { useKioskMode, verifyKioskPin } from '@/hooks/useKioskMode';

/**
 * Kiosk rejimi: planshetda ilovadan chiqib ketishni maksimal darajada cheklaydi.
 * Chiqish faqat PIN kod orqali.
 */
export default function KioskGuard() {
  const { enabled, disable } = useKioskMode();
  const [askExit, setAskExit] = useState(false);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);

  // To'liq ekran + brauzer chiqish yo'llarini bloklash
  useEffect(() => {
    if (!enabled) return;

    const requestFs = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // brauzer ruxsat bermasa — jim o'tamiz
      }
    };

    const onInteract = () => { void requestFs(); };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const blockedCombo =
        (e.ctrlKey || e.metaKey) && ['r', 'w', 't', 'n', 'p', 'u', 'shift'].includes(k);
      const blockedKey = ['f5', 'f11', 'f12'].includes(k);
      const altNav = e.altKey && (k === 'arrowleft' || k === 'arrowright');
      if (blockedCombo || blockedKey || altNav) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // Orqaga tugmasi tuzog'i
    history.pushState(null, '', window.location.href);
    const onPopState = () => {
      history.pushState(null, '', window.location.href);
    };

    const onFsChange = () => {
      if (!document.fullscreenElement) {
        // foydalanuvchi chiqib ketsa — keyingi tegishda qayta ochiladi
        setTimeout(() => { void requestFs(); }, 300);
      }
    };

    document.addEventListener('click', onInteract);
    document.addEventListener('touchend', onInteract);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    return () => {
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchend', onInteract);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [enabled]);

  if (!enabled) return null;

  const tryExit = async () => {
    setChecking(true);
    const ok = await verifyKioskPin(pin);
    setChecking(false);
    if (!ok) {
      toast.error("PIN kod noto'g'ri");
      setPin('');
      return;
    }
    disable();
    setAskExit(false);
    setPin('');
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    toast.success('Kiosk rejimi o\'chirildi');
  };

  return (
    <>
      <button
        type="button"
        aria-label="Kiosk rejimidan chiqish"
        onClick={() => setAskExit(true)}
        className="fixed bottom-3 left-3 z-[60] w-9 h-9 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
      >
        <Lock className="w-4 h-4" />
      </button>

      <Dialog open={askExit} onOpenChange={(o) => { setAskExit(o); if (!o) setPin(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-primary" />
              Kiosk rejimidan chiqish
            </DialogTitle>
            <DialogDescription>
              Ilovadan chiqish uchun kiosk PIN kodini kiriting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kiosk-exit-pin">PIN kod</Label>
            <div className="flex gap-2">
              <Input
                id="kiosk-exit-pin"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void tryExit(); }}
                className="font-mono"
                placeholder="••••"
              />
              <Button onClick={() => void tryExit()} disabled={!pin.trim() || checking}>
                Chiqish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
