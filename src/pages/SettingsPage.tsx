import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Camera, Keyboard, Info, Volume2, Play, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { useScannerMode } from '@/hooks/useScannerMode';
import { useSoundEnabled, useSoundFeedback } from '@/hooks/useSoundFeedback';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [scannerMode, setScannerMode] = useScannerMode();
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  const { test } = useSoundFeedback();
  const [workerPin, setWorkerPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setPinLoading(true);
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'worker_pin')
        .maybeSingle();
      if (data?.value) setWorkerPin(data.value);
      setPinLoading(false);
    })();
  }, []);

  const savePin = async () => {
    const trimmed = newPin.trim();
    if (trimmed.length < 3 || trimmed.length > 12) {
      toast.error('PIN 3 dan 12 belgigacha bo\'lishi kerak');
      return;
    }
    setPinSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: trimmed })
      .eq('key', 'worker_pin');
    setPinSaving(false);
    if (error) {
      toast.error('Saqlashda xatolik: ' + error.message);
      return;
    }
    setWorkerPin(trimmed);
    setNewPin('');
    toast.success('Ishchi PIN kodi yangilandi');
  };

  const handleToggle = (v: boolean) => {
    setScannerMode(v);
    toast.success(v ? 'Skaner gun rejimi yoqildi' : 'Skaner gun rejimi o\'chirildi');
  };

  const handleSoundToggle = (v: boolean) => {
    setSoundEnabled(v);
    if (v) test();
    toast.success(v ? 'Tovush bilan tasdiqlash yoqildi' : 'Tovush o\'chirildi');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sozlamalar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ilova ishlash rejimini moslang
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-primary" />
            Skaner gun rejimi
          </CardTitle>
          <CardDescription>
            USB skaner gun yoki USB RFID o'quvchi bilan ishlash uchun optimallashtirilgan rejim.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-1 flex-1 min-w-0">
              <Label htmlFor="scanner-toggle" className="text-sm font-medium cursor-pointer">
                Rejimni yoqish
              </Label>
              <p className="text-xs text-muted-foreground">
                Yoqilganda kamera va telefon NFC tugmalari yashirinadi, skanerlash inputlariga avtomatik fokus beriladi.
              </p>
            </div>
            <Switch
              id="scanner-toggle"
              checked={scannerMode}
              onCheckedChange={handleToggle}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Rejim yoqilganda nima o'zgaradi?</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Keyboard className="w-4 h-4 text-success" />
                  Faol bo'ladi
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>Inputlarga avtomatik fokus</li>
                  <li>Enter bilan tezkor tasdiqlash</li>
                  <li>Toza, sodda interfeys</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  Yashiriladi
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>"Kamera orqali skanerlash" tugmasi</li>
                  <li>"NFC skaner" tugmasi (telefon)</li>
                  <li>QR/Barkod skaner dialoglar</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-foreground/80">
              <p className="font-medium text-foreground mb-1">Maslahat</p>
              <p>
                USB skaner gun yoki USB RFID o'quvchi klaviatura emulyatsiyasi (HID) rejimida ishlaydi —
                skanerlangan kod inputga yoziladi va Enter bosiladi. Hech qanday qo'shimcha drayver kerak emas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            Tovush bilan tasdiqlash
          </CardTitle>
          <CardDescription>
            Har bir muvaffaqiyatli skanerlashda qisqa "beep" ovozi chiqadi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-1 flex-1 min-w-0">
              <Label htmlFor="sound-toggle" className="text-sm font-medium cursor-pointer">
                Beep ovozini yoqish
              </Label>
              <p className="text-xs text-muted-foreground">
                Skanerlash muvaffaqiyatli bo'lganda yuqori chastotali qisqa signal, xatolikda past signal eshitiladi.
              </p>
            </div>
            <Switch
              id="sound-toggle"
              checked={soundEnabled}
              onCheckedChange={handleSoundToggle}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => test()}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Ovozni sinab ko'rish
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
