import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosDialog, setShowIosDialog] = useState(false);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS Safari property
    window.navigator.standalone === true;

  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isStandalone]);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isIos && !deferredPrompt) {
      setShowIosDialog(true);
      return;
    }
    if (!deferredPrompt) {
      setShowIosDialog(true);
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Ilovani o'rnatish
      </Button>

      <Dialog open={showIosDialog} onOpenChange={setShowIosDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Ilovani telefoningizga o'rnating
            </DialogTitle>
            <DialogDescription>
              Aqilli Omborxona ilovasini bosh ekraningizga qo'shing.
            </DialogDescription>
          </DialogHeader>
          {isIos ? (
            <ol className="space-y-3 text-sm text-foreground list-decimal list-inside">
              <li>Safari pastidagi <strong>Share</strong> tugmasini bosing (yuqoriga strelka).</li>
              <li><strong>"Add to Home Screen"</strong> bandini tanlang.</li>
              <li>Yuqori o'ng burchakdagi <strong>"Add"</strong> tugmasini bosing.</li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm text-foreground list-decimal list-inside">
              <li>Brauzeringizning menyusini oching (3 nuqta).</li>
              <li><strong>"Install app"</strong> yoki <strong>"Add to Home screen"</strong> ni tanlang.</li>
              <li>Tasdiqlash uchun <strong>"Install"</strong> ni bosing.</li>
            </ol>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            Eslatma: O'rnatish faqat published versiyada ishlaydi (preview'da emas).
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
