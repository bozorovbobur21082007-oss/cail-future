import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * NFC o'qish hook'i.
 * - Web NFC API (Android Chrome) orqali to'g'ridan-to'g'ri NFC tegni o'qish
 * - USB/Bluetooth RFID HID o'quvchilar uchun esa odatda Input maydonida ishlaydi —
 *   buni alohida hook ko'rinishida `useHidScannerInput` orqali qo'llaymiz.
 */

type NfcSupport = 'supported' | 'unsupported' | 'unknown';

export function useNfcReader(onRead: (serial: string) => void) {
  const [scanning, setScanning] = useState(false);
  const [support, setSupport] = useState<NfcSupport>('unknown');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastReadRef = useRef<{ uid: string; at: number } | null>(null);

  /** Skaner boshlangandan keyin shu ms ichida kelgan o'qishlar tashlab yuboriladi (kesh/g'oyibona o'qishlar). */
  const STARTUP_GUARD_MS = 1000;
  /** Bir xil UID ni shu ms ichida takror qabul qilmaymiz (debounce). */
  const DEDUPE_MS = 2500;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupport('NDEFReader' in window ? 'supported' : 'unsupported');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!('NDEFReader' in window)) {
      setError("Bu qurilma yoki brauzer NFC'ni qo'llab-quvvatlamaydi (faqat Android Chrome).");
      return;
    }
    try {
      // @ts-ignore - NDEFReader hali standart TS tiplarida yo'q
      const reader = new window.NDEFReader();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      await reader.scan({ signal: ctrl.signal });
      startedAtRef.current = Date.now();
      lastReadRef.current = null;
      setScanning(true);

      reader.onreadingerror = () => {
        setError("NFC tegni o'qib bo'lmadi. Qaytadan urinib ko'ring.");
      };

      reader.onreading = (event: any) => {
        const now = Date.now();
        // 1) Startup guard — skaner endigina yoqilganda kelgan keshlangan o'qishni tashlash
        if (now - startedAtRef.current < STARTUP_GUARD_MS) {
          return;
        }
        const serial: string = event.serialNumber || '';
        const cleaned = serial.replace(/:/g, '').toUpperCase();
        if (!cleaned) return;
        // 2) Dedupe — bir xil UID juda tez takrorlanishini oldini olish
        const last = lastReadRef.current;
        if (last && last.uid === cleaned && now - last.at < DEDUPE_MS) {
          return;
        }
        lastReadRef.current = { uid: cleaned, at: now };
        onRead(cleaned);
      };
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/permission|NotAllowed/i.test(msg)) {
        setError("NFC uchun ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.");
      } else if (/NotSupported/i.test(msg)) {
        setError("Bu qurilma NFC'ni qo'llab-quvvatlamaydi.");
      } else {
        setError("NFC ishga tushmadi: " + msg);
      }
      setScanning(false);
    }
  }, [onRead]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { start, stop, scanning, support, error };
}

/**
 * USB/Bluetooth HID rejimidagi RFID o'quvchi odatda klaviatura kabi ishlaydi —
 * input'ga yozadi va Enter bosadi. Bu hook input qiymatini kuzatadi va Enter'da
 * onRead chaqiradi. Foydalanuvchi shunchaki input'ni focus qilib teg yaqinlashtiradi.
 */
