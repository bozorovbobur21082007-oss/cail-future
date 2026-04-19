import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Radio, X, Loader2, Smartphone, Keyboard, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNfcReader } from '@/hooks/useNfc';

interface Props {
  /** NFC ID o'qilganda chaqiriladi (UID, hex/string ko'rinishida). */
  onScan: (nfcId: string) => void;
  onClose: () => void;
  /** RFID o'quvchi uchun input avtomatik focus bo'lsin (default true). */
  autoFocusHid?: boolean;
  title?: string;
}

/**
 * Ikki rejimda NFC qabul qilish:
 *  1) Telefon Web NFC (Android Chrome) — NDEFReader orqali UID o'qiladi
 *  2) USB/Bluetooth HID RFID o'quvchi — input'ga yozadi, Enter bosiladi
 */
export default function NfcScanner({ onScan, onClose, autoFocusHid = true, title = "NFC tegni skanerlash" }: Props) {
  const [hidValue, setHidValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { start, stop, scanning, support, error } = useNfcReader((uid) => {
    onScan(uid);
  });

  useEffect(() => {
    if (autoFocusHid) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [autoFocusHid]);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  const submitHid = () => {
    const v = hidValue.trim();
    if (!v) return;
    onScan(v.toUpperCase());
    setHidValue('');
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="w-4 h-4 text-primary" />
            {title}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { stop(); onClose(); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* HID rejim: USB/Bluetooth RFID o'quvchi */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Keyboard className="w-3.5 h-3.5" /> USB/Bluetooth RFID o'quvchi
          </Label>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={hidValue}
              onChange={(e) => setHidValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitHid()}
              placeholder="Tegni o'quvchiga yaqinlashtiring..."
              className="font-mono"
            />
            <Button onClick={submitHid} disabled={!hidValue.trim()} size="sm">OK</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O'quvchi avtomatik tarzda NFC ID ni yozadi va Enter bosadi.
          </p>
        </div>

        <div className="border-t border-border/50" />

        {/* Web NFC rejim: Android Chrome */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Smartphone className="w-3.5 h-3.5" /> Telefon NFC (Android Chrome)
          </Label>
          {support === 'unsupported' && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/50">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Bu qurilma yoki brauzer Web NFC'ni qo'llab-quvvatlamaydi. Android telefon va Chrome brauzer kerak.</span>
            </div>
          )}
          {support !== 'unsupported' && (
            scanning ? (
              <Button variant="outline" className="w-full gap-2" onClick={stop}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Skanerlanmoqda... (to'xtatish)
              </Button>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={start}>
                <Radio className="w-4 h-4" />
                Telefon NFC'ni yoqish
              </Button>
            )
          )}
          {scanning && (
            <p className="text-[11px] text-primary flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Tegni telefon orqasiga yaqinlashtiring
            </p>
          )}
          {error && (
            <p className="text-[11px] text-destructive flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
