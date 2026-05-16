import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Serial API hook — Arduino (Nano + RC522) bilan to'g'ridan-to'g'ri ulanish.
 * Chrome/Edge desktop'da ishlaydi. Arduino \n bilan tugagan UID yuborishi kerak.
 *
 * Avtomatik ulanish + voqealar logi (sabab bilan).
 */

type SerialSupport = 'supported' | 'unsupported' | 'unknown';

export type SerialLogLevel = 'info' | 'success' | 'warn' | 'error';
export interface SerialLogEntry {
  id: number;
  at: number;
  level: SerialLogLevel;
  message: string;
}

const AUTO_CONNECT_KEY = 'web_serial_auto_connect';
const LOG_KEY = 'web_serial_log';
const MAX_LOG = 50;

const loadLog = (): SerialLogEntry[] => {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_LOG) : [];
  } catch { return []; }
};

const saveLog = (log: SerialLogEntry[]) => {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_LOG))); } catch {}
};

export function useWebSerial(onRead: (uid: string) => void) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [support, setSupport] = useState<SerialSupport>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<SerialLogEntry[]>(() => loadLog());
  const [status, setStatus] = useState<string>('Hech qachon ulanmagan');

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const lastReadRef = useRef<{ uid: string; at: number } | null>(null);
  const onReadRef = useRef(onRead);
  const logIdRef = useRef<number>(Date.now());

  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  const DEDUPE_MS = 1500;

  const appendLog = useCallback((level: SerialLogLevel, message: string) => {
    logIdRef.current += 1;
    const entry: SerialLogEntry = { id: logIdRef.current, at: Date.now(), level, message };
    setLog((prev) => {
      const next = [...prev, entry].slice(-MAX_LOG);
      saveLog(next);
      return next;
    });
    setStatus(message);
  }, []);

  const clearLog = useCallback(() => {
    setLog([]);
    try { localStorage.removeItem(LOG_KEY); } catch {}
  }, []);

  const startReadingPort = useCallback(async (port: any, reason: string) => {
    portRef.current = port;
    setConnected(true);
    setConnecting(false);
    keepReadingRef.current = true;
    appendLog('success', `Ulandi (${reason})`);

    const textDecoder = new TextDecoderStream();
    const readableClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {});
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
    let exitReason = 'stream tugadi';
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) { exitReason = 'stream yopildi'; break; }
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
      exitReason = "o'qish xatosi: " + (e?.message || String(e));
      if (keepReadingRef.current) {
        setError("O'qishda xatolik: " + (e?.message || String(e)));
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      await readableClosed;
      setConnected(false);
      if (keepReadingRef.current) {
        appendLog('warn', `Uzildi: ${exitReason}`);
      }
      keepReadingRef.current = false;
    }
  }, [appendLog]);

  const tryOpenPort = useCallback(async (port: any, reason: string) => {
    try {
      await port.open({ baudRate: 9600 });
      startReadingPort(port, reason);
      return true;
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/already open/i.test(msg)) {
        startReadingPort(port, reason + ' — port allaqachon ochiq');
        return true;
      }
      appendLog('error', `Ochib bo'lmadi (${reason}): ${msg}`);
      return false;
    }
  }, [startReadingPort, appendLog]);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    try { localStorage.setItem(AUTO_CONNECT_KEY, '0'); } catch {}
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
      appendLog('info', 'Foydalanuvchi uzdi (auto-ulanish o\'chirildi)');
    }
  }, [appendLog]);

  const connect = useCallback(async () => {
    setError(null);
    // @ts-ignore
    if (!('serial' in navigator)) {
      const m = "Brauzer Web Serial'ni qo'llab-quvvatlamaydi.";
      setError(m);
      appendLog('error', m);
      return;
    }
    try {
      setConnecting(true);
      appendLog('info', 'Port tanlash so\'ralmoqda...');
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      const ok = await tryOpenPort(port, 'qo\'lda ulanish');
      if (ok) {
        try { localStorage.setItem(AUTO_CONNECT_KEY, '1'); } catch {}
      } else {
        setConnecting(false);
        const m = "Port band — Arduino IDE Serial Monitor'ni yoping.";
        setError(m);
      }
    } catch (e: any) {
      setConnecting(false);
      const msg = e?.message || String(e);
      if (/No port selected|cancelled/i.test(msg)) {
        appendLog('info', 'Port tanlash bekor qilindi');
        return;
      }
      if (/in use|Failed to open/i.test(msg)) {
        const m = "Port band — Arduino IDE Serial Monitor'ni yoping.";
        setError(m);
        appendLog('error', m);
      } else {
        setError("Ulanishda xatolik: " + msg);
        appendLog('error', "Ulanishda xatolik: " + msg);
      }
    }
  }, [tryOpenPort, appendLog]);

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

    const tryAutoConnect = async (reason: string) => {
      if (cancelled || portRef.current) return;
      try {
        // @ts-ignore
        const ports = await navigator.serial.getPorts();
        if (!ports.length) {
          appendLog('warn', `Auto-ulanish (${reason}): ruxsat berilgan port topilmadi`);
          return;
        }
        appendLog('info', `Auto-ulanish (${reason})...`);
        await tryOpenPort(ports[0], `auto: ${reason}`);
      } catch (e: any) {
        appendLog('error', `Auto-ulanish xatosi: ${e?.message || String(e)}`);
      }
    };

    if (auto) tryAutoConnect('sahifa yuklandi');

    const onConnect = () => {
      appendLog('info', 'Qurilma ulandi (USB)');
      if (auto) tryAutoConnect('USB qurilma ulandi');
    };
    const onDisconnect = (e: any) => {
      if (portRef.current && e.target === portRef.current) {
        appendLog('warn', 'Qurilma uzildi (USB kabel/quvvat)');
        keepReadingRef.current = false;
        portRef.current = null;
        setConnected(false);
      } else {
        appendLog('info', 'Boshqa qurilma uzildi');
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
  }, [tryOpenPort, appendLog]);

  return { connect, disconnect, connected, connecting, support, error, log, status, clearLog };
}
