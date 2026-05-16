import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Radio, X, Loader2, Smartphone, Keyboard, AlertTriangle, CheckCircle2, Usb, CheckCircle } from 'lucide-react';
import { useNfcReader } from '@/hooks/useNfc';
import { useWebSerial } from '@/hooks/useWebSerial';
import { toast } from 'sonner';

interface Props {
  /** NFC ID o'qilganda chaqiriladi (UID, hex/string ko'rinishida). */
  onScan: (nfcId: string) => void;
  onClose: () => void;
  /** RFID o'quvchi uchun input avtomatik focus bo'lsin (default false — tasodifan klaviatura yozuvlarini qabul qilmaslik uchun). */
  autoFocusHid?: boolean;
  title?: string;
}

/** NFC ID minimal uzunlik (4 baytlik UID = 8 hex belgisi). */
const MIN_NFC_LEN = 6;
/** Faqat NFC UID uchun mosil belgilar (hex + harf-raqam). */
const VALID_NFC_RE = /^[A-Z0-9]+$/;

/**
 * Ikki rejimda NFC qabul qilish:
 *  1) Telefon Web NFC (Android Chrome) — NDEFReader orqali UID o'qiladi
 *  2) USB/Bluetooth HID RFID o'quvchi — input'ga yozadi, Enter bosiladi
 *
 * MUHIM: HID input avtomatik focus QILINMAYDI default holatda, chunki
 * tasodifan bosilgan klaviatura tugmalari NFC ID deb qabul qilinishi mumkin.
 * Foydalanuvchi o'zi inputni bosib, keyin tegni o'qitishi kerak.
 */
export default function NfcScanner({ onScan, onClose, autoFocusHid = false, title = "NFC tegni skanerlash" }: Props) {
  const [hidValue, setHidValue] = useState('');
  const [hidActive, setHidActive] = useState(autoFocusHid);
  const inputRef = useRef<HTMLInputElement>(null);

  const { start, stop, scanning, support, error } = useNfcReader((uid) => {
    onScan(uid);
  });

  const serial = useWebSerial((uid) => {
    onScan(uid);
  });

  useEffect(() => {
    if (autoFocusHid && hidActive) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [autoFocusHid, hidActive]);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  // Web NFC yoqilganda HID input focusdan olinadi — ikkala rejim bir vaqtda ishlamasligi uchun
  useEffect(() => {
    if (scanning) {
      inputRef.current?.blur();
      setHidActive(false);
    }
  }, [scanning]);

  const submitHid = () => {
    const v = hidValue.trim().toUpperCase();
    if (!v) return;
    if (v.length < MIN_NFC_LEN) {
      toast.error(`NFC ID juda qisqa (kamida ${MIN_NFC_LEN} ta belgi). Tegni o'quvchiga to'liq yaqinlashtiring.`);
      return;
    }
    if (!VALID_NFC_RE.test(v)) {
      toast.error("NFC ID faqat raqam va harflardan iborat bo'lishi kerak.");
      return;
    }
    onScan(v);
    setHidValue('');
  };

  const activateHid = () => {
    setHidActive(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const startWebNfc = () => {
    inputRef.current?.blur();
    setHidActive(false);
    setHidValue('');
    start();
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
          {!hidActive ? (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={activateHid} disabled={scanning}>
              <Keyboard className="w-4 h-4" />
              RFID o'quvchini yoqish
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={hidValue}
                onChange={(e) => setHidValue(e.target.value.replace(/\s+/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitHid())}
                onBlur={() => { if (!hidValue) setHidActive(false); }}
                placeholder="Tegni o'quvchiga yaqinlashtiring..."
                className="font-mono"
              />
              <Button onClick={submitHid} disabled={!hidValue.trim()} size="sm">OK</Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            O'quvchi avtomatik tarzda NFC ID ni yozadi va Enter bosadi (kamida {MIN_NFC_LEN} ta belgi).
          </p>
        </div>

        <div className="border-t border-border/50" />

        {/* Web Serial rejim: Arduino + RC522 (USB) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Usb className="w-3.5 h-3.5" /> Arduino RFID (USB — Chrome/Edge)
          </Label>
          {serial.support === 'unsupported' ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/50">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Brauzer Web Serial'ni qo'llab-quvvatlamaydi. Chrome yoki Edge desktop kerak.</span>
            </div>
          ) : serial.connected ? (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={serial.disconnect}>
              <CheckCircle className="w-4 h-4 text-primary" />
              Arduino ulangan — uzish
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={serial.connect} disabled={serial.connecting}>
              {serial.connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
              Arduino'ni ulash (COM port tanlang)
            </Button>
          )}
          {serial.connected && (
            <p className="text-[11px] text-primary flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Tegni RC522 o'quvchiga yaqinlashtiring
            </p>
          )}
          {serial.error && (
            <p className="text-[11px] text-destructive flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {serial.error}
            </p>
          )}

          {/* Status + voqealar logi */}
          <div className="rounded border border-border/50 bg-background/50 p-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Holat:</span>
              <span className={`flex items-center gap-1 ${serial.connected ? 'text-primary' : 'text-muted-foreground'}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${serial.connected ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                {serial.status}
              </span>
            </div>
            {serial.log.length > 0 && (
              <>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Voqealar ({serial.log.length})</span>
                  <button type="button" onClick={serial.clearLog} className="hover:text-foreground underline">tozalash</button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 font-mono text-[10px]">
                  {[...serial.log].reverse().map((entry) => (
                    <div key={entry.id} className="flex gap-1.5">
                      <span className="text-muted-foreground shrink-0">
                        {new Date(entry.at).toLocaleTimeString('uz-UZ', { hour12: false })}
                      </span>
                      <span className={
                        entry.level === 'error' ? 'text-destructive' :
                        entry.level === 'warn' ? 'text-orange-500' :
                        entry.level === 'success' ? 'text-primary' :
                        'text-foreground'
                      }>
                        {entry.message}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Muhim: Arduino IDE'da Serial Monitor yopiq bo'lsin (port bir vaqtda faqat bittasi tomonidan ushlanadi).
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
              <Button variant="outline" className="w-full gap-2" onClick={startWebNfc}>
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
