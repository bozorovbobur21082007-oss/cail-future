import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Serial API hook — Arduino (Nano + RC522) bilan to'g'ridan-to'g'ri ulanish.
 * Chrome/Edge desktop'da ishlaydi. Arduino \n bilan tugagan UID yuborishi kerak.
 */

type SerialSupport = 'supported' | 'unsupported' | 'unknown';

export function useWebSerial(onRead: (uid: string) => void) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [support, setSupport] = useState<SerialSupport>('unknown');
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const lastReadRef = useRef<{ uid: string; at: number } | null>(null);
  const onReadRef = useRef(onRead);

  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  const DEDUPE_MS = 1500;

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setSupport('serial' in navigator ? 'supported' : 'unsupported');
  }, []);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch {}
        try { readerRef.current.releaseLock(); } catch {}
        readerRef.current = null;
      }
      if (portRef.current) {
        try { await portRef.current.close(); } catch {}
        portRef.current = null;
      }
    } finally {
      setConnected(false);
      setConnecting(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    // @ts-ignore
    if (!('serial' in navigator)) {
      setError("Brauzer Web Serial'ni qo'llab-quvvatlamaydi. Chrome yoki Edge desktop kerak.");
      return;
    }
    try {
      setConnecting(true);
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setConnected(true);
      setConnecting(false);
      keepReadingRef.current = true;

      const textDecoder = new TextDecoderStream();
      const readableClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {});
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      let buffer = '';
      (async () => {
        try {
          while (keepReadingRef.current) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;
            buffer += value;
            let idx;
            while ((idx = buffer.search(/[\r\n]/)) !== -1) {
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
              if (!line) continue;
              const cleaned = line.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (cleaned.length < 6) continue;
              const now = Date.now();
              const last = lastReadRef.current;
              if (last && last.uid === cleaned && now - last.at < DEDUPE_MS) continue;
              lastReadRef.current = { uid: cleaned, at: now };
              onReadRef.current(cleaned);
            }
          }
        } catch (e: any) {
          if (keepReadingRef.current) {
            setError("O'qishda xatolik: " + (e?.message || String(e)));
          }
        } finally {
          try { reader.releaseLock(); } catch {}
          await readableClosed;
        }
      })();
    } catch (e: any) {
      setConnecting(false);
      const msg = e?.message || String(e);
      if (/No port selected|cancelled/i.test(msg)) {
        // Foydalanuvchi bekor qildi — xato emas
        return;
      }
      if (/in use|Failed to open/i.test(msg)) {
        setError("Port band — Arduino IDE'da Serial Monitor'ni yoping va qaytadan urinib ko'ring.");
      } else {
        setError("Ulanishda xatolik: " + msg);
      }
    }
  }, []);

  useEffect(() => () => { disconnect(); }, [disconnect]);

  return { connect, disconnect, connected, connecting, support, error };
}
