import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Serial API hook — Arduino (Nano + RC522) bilan to'g'ridan-to'g'ri ulanish.
 * Chrome/Edge desktop'da ishlaydi. Arduino \n bilan tugagan UID yuborishi kerak.
 *
 * Avtomatik ulanish: foydalanuvchi bir marta portni tanlagandan so'ng,
 * brauzer ruxsatni eslab qoladi. Hook har sahifa yuklanganda
 * `navigator.serial.getPorts()` orqali ruxsat berilgan portlarni tekshiradi
 * va birinchisiga avtomatik ulanadi. Bu skaner gun rejimida ham ishlaydi.
 */

type SerialSupport = 'supported' | 'unsupported' | 'unknown';

const AUTO_CONNECT_KEY = 'web_serial_auto_connect';

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

  const startReadingPort = useCallback(async (port: any) => {
    portRef.current = port;
    setConnected(true);
    setConnecting(false);
    keepReadingRef.current = true;

    const textDecoder = new TextDecoderStream();
    const readableClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {});
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
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
      setConnected(false);
    }
  }, []);

  const tryOpenPort = useCallback(async (port: any) => {
    try {
      await port.open({ baudRate: 9600 });
      startReadingPort(port);
      return true;
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/already open/i.test(msg)) {
        // Allaqachon ochilgan — o'qishni boshlaymiz
        startReadingPort(port);
        return true;
      }
      return false;
    }
  }, [startReadingPort]);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    try {
      localStorage.setItem(AUTO_CONNECT_KEY, '0');
    } catch {}
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
      const ok = await tryOpenPort(port);
      if (ok) {
        try { localStorage.setItem(AUTO_CONNECT_KEY, '1'); } catch {}
      } else {
        setConnecting(false);
        setError("Port band — Arduino IDE'da Serial Monitor'ni yoping va qaytadan urinib ko'ring.");
      }
    } catch (e: any) {
      setConnecting(false);
      const msg = e?.message || String(e);
      if (/No port selected|cancelled/i.test(msg)) return;
      if (/in use|Failed to open/i.test(msg)) {
        setError("Port band — Arduino IDE'da Serial Monitor'ni yoping va qaytadan urinib ko'ring.");
      } else {
        setError("Ulanishda xatolik: " + msg);
      }
    }
  }, [tryOpenPort]);

  // Avtomatik ulanish: sahifa yuklanganda ruxsat berilgan portlarni tekshirish
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    // @ts-ignore
    if (!('serial' in navigator)) {
      setSupport('unsupported');
      return;
    }
    setSupport('supported');

    let cancelled = false;
    const auto = (() => { try { return localStorage.getItem(AUTO_CONNECT_KEY) === '1'; } catch { return false; } })();

    const tryAutoConnect = async () => {
      if (cancelled || portRef.current) return;
      try {
        // @ts-ignore
        const ports = await navigator.serial.getPorts();
        if (!ports.length) return;
        // Birinchi ruxsat berilgan portga ulanamiz
        await tryOpenPort(ports[0]);
      } catch {}
    };

    if (auto) tryAutoConnect();

    // @ts-ignore
    const onConnect = () => { if (auto) tryAutoConnect(); };
    // @ts-ignore
    const onDisconnect = (e: any) => {
      if (portRef.current && e.target === portRef.current) {
        keepReadingRef.current = false;
        portRef.current = null;
        setConnected(false);
      }
    };

    // @ts-ignore
    navigator.serial.addEventListener('connect', onConnect);
    // @ts-ignore
    navigator.serial.addEventListener('disconnect', onDisconnect);

    return () => {
      cancelled = true;
      // @ts-ignore
      navigator.serial.removeEventListener('connect', onConnect);
      // @ts-ignore
      navigator.serial.removeEventListener('disconnect', onDisconnect);
    };
  }, [tryOpenPort]);

  // Hook unmount bo'lganda portni yopmaymiz — ulanish doimiy bo'lishi kerak
  // (foydalanuvchi sahifalar orasida o'tganda Arduino ulangan holatda qoladi)

  return { connect, disconnect, connected, connecting, support, error };
}
