import { useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
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
  const [locked, setLocked] = useState(false); // to'liq ekrandan chiqib ketilgan holat

  // To'liq ekran + brauzer chiqish yo'llarini bloklash
  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      return;
    }

    const requestFs = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
        // Chrome: Esc tugmasi to'liq ekrandan chiqarmasligi uchun
        const kb = (navigator as any).keyboard;
        if (kb?.lock) {
          try { await kb.lock(['Escape', 'F11']); } catch { /* ignore */ }
        }
        setLocked(false);
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
      const blockedKey = ['f5', 'f11', 'f12', 'escape'].includes(k);
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

    // Android hardware Back va brauzer Back tugmasi tuzog'i.
    // Joriy manzil ustiga qo'shimcha tarix yozuvi qo'yiladi; Back bosilganda
    // foydalanuvchi sahifadan chiqmaydi va faqat PIN oynasi ochiladi.
    const kioskHistoryState = { kioskGuard: true };
    history.replaceState(kioskHistoryState, '', window.location.href);
    history.pushState(kioskHistoryState, '', window.location.href);
    const onPopState = () => {
      history.pushState(kioskHistoryState, '', window.location.href);
      setAskExit(true);
      setPin('');
    };

    const onFsChange = () => {
      if (!document.fullscreenElement) {
        // foydalanuvchi chiqib ketsa — ekranni bloklaymiz va qayta ochishga urinamiz
        setLocked(true);
        setTimeout(() => { void requestFs(); }, 200);
      } else {
        setLocked(false);
      }
    };

    void requestFs();

    document.addEventListener('click', onInteract);
    document.addEventListener('touchend', onInteract);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyDown, true);
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    return () => {
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchend', onInteract);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyDown, true);
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
      const kb = (navigator as any).keyboard;
      if (kb?.unlock) { try { kb.unlock(); } catch { /* ignore */ } }
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
      {locked && !askExit && (
        <div className="fixed inset-0 z-[80] bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
          <BrandLogo className="h-12 w-auto object-contain mb-2" />
          <Lock className="w-10 h-10 text-primary" />
          <div>
            <p className="text-lg font-semibold text-foreground">Kiosk rejimi qulflangan</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ilovadan chiqish faqat PIN kod orqali mumkin.
            </p>
          </div>
          <Button
            onClick={() => {
              void document.documentElement.requestFullscreen().catch(() => {});
            }}
          >
            Davom etish
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAskExit(true)}>
            PIN kod bilan chiqish
          </Button>
        </div>
      )}

      <button
        type="button"
        aria-label="Kiosk rejimidan chiqish"
        onClick={() => setAskExit(true)}
        className="fixed bottom-3 left-3 z-[60] w-9 h-9 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
      >
        <Lock className="w-4 h-4" />
      </button>

      <Dialog open={askExit} onOpenChange={(o) => { setAskExit(o); if (!o) setPin(''); }}>

        <DialogContent className="max-w-sm z-[90]" onEscapeKeyDown={(e) => e.preventDefault()}>
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
