/**
 * Singleton Web Serial xizmati — Arduino (Nano + RC522) bilan global ulanish.
 *
 * Bir marta ulansa, butun ilova bo'ylab faqat BITTA ulanish ushlab turiladi.
 * UID kelganda `web-serial-uid` CustomEvent dispatch qilinadi va barcha
 * subscriberlarga yetkaziladi. Skaner gun rejimi yoqilgan bo'lsa ham,
 * NfcScanner UI ko'rinmasa ham — ulanish AppLayout darajasida saqlanadi.
 */

export type SerialSupport = 'supported' | 'unsupported' | 'unknown';
export type SerialLogLevel = 'info' | 'success' | 'warn' | 'error';

export interface SerialLogEntry {
  id: number;
  at: number;
  level: SerialLogLevel;
  message: string;
}

export interface SerialState {
  connected: boolean;
  connecting: boolean;
  support: SerialSupport;
  error: string | null;
  status: string;
  log: SerialLogEntry[];
}

const AUTO_CONNECT_KEY = 'web_serial_auto_connect';
const LOG_KEY = 'web_serial_log';
const MAX_LOG = 50;
const DEDUPE_MS = 1500;

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

class WebSerialService {
  private state: SerialState = {
    connected: false,
    connecting: false,
    support: 'unknown',
    error: null,
    status: 'Hech qachon ulanmagan',
    log: loadLog(),
  };

  private listeners = new Set<(s: SerialState) => void>();
  private uidListeners = new Set<(uid: string) => void>();
  private port: any = null;
  private reader: any = null;
  private keepReading = false;
  private lastRead: { uid: string; at: number } | null = null;
  private logIdCounter = Date.now();
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    if (typeof navigator === 'undefined') return;
    // @ts-ignore
    if (!('serial' in navigator)) {
      this.update({ support: 'unsupported' });
      return;
    }
    this.update({ support: 'supported' });

    const auto = (() => { try { return localStorage.getItem(AUTO_CONNECT_KEY) === '1'; } catch { return false; } })();
    if (auto) this.tryAutoConnect('sahifa yuklandi');

    // @ts-ignore
    navigator.serial.addEventListener('connect', () => {
      this.appendLog('info', 'Qurilma ulandi (USB)');
      const a = (() => { try { return localStorage.getItem(AUTO_CONNECT_KEY) === '1'; } catch { return false; } })();
      if (a) this.tryAutoConnect('USB qurilma ulandi');
    });
    // @ts-ignore
    navigator.serial.addEventListener('disconnect', (e: any) => {
      if (this.port && e.target === this.port) {
        this.appendLog('warn', 'Qurilma uzildi (USB kabel/quvvat)');
        this.keepReading = false;
        this.port = null;
        this.update({ connected: false });
      }
    });
  }

  subscribe(listener: (s: SerialState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  onUid(listener: (uid: string) => void) {
    this.uidListeners.add(listener);
    return () => { this.uidListeners.delete(listener); };
  }

  getState() { return this.state; }

  private update(patch: Partial<SerialState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private appendLog(level: SerialLogLevel, message: string) {
    this.logIdCounter += 1;
    const entry: SerialLogEntry = { id: this.logIdCounter, at: Date.now(), level, message };
    const log = [...this.state.log, entry].slice(-MAX_LOG);
    saveLog(log);
    this.update({ log, status: message });
  }

  clearLog() {
    try { localStorage.removeItem(LOG_KEY); } catch {}
    this.update({ log: [] });
  }

  private async tryAutoConnect(reason: string) {
    if (this.port) return;
    try {
      // @ts-ignore
      const ports = await navigator.serial.getPorts();
      if (!ports.length) {
        this.appendLog('warn', `Auto-ulanish (${reason}): ruxsat berilgan port topilmadi`);
        return;
      }
      this.appendLog('info', `Auto-ulanish (${reason})...`);
      await this.openAndRead(ports[0], `auto: ${reason}`);
    } catch (e: any) {
      this.appendLog('error', `Auto-ulanish xatosi: ${e?.message || String(e)}`);
    }
  }

  private async openAndRead(port: any, reason: string): Promise<boolean> {
    try {
      await port.open({ baudRate: 9600 });
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!/already open/i.test(msg)) {
        this.appendLog('error', `Ochib bo'lmadi (${reason}): ${msg}`);
        return false;
      }
    }
    this.port = port;
    this.keepReading = true;
    this.update({ connected: true, connecting: false, error: null });
    this.appendLog('success', `Ulandi (${reason})`);
    this.readLoop(port);
    return true;
  }

  private async readLoop(port: any) {
    const textDecoder = new TextDecoderStream();
    const readableClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {});
    const reader = textDecoder.readable.getReader();
    this.reader = reader;

    let buffer = '';
    let exitReason = 'stream tugadi';
    try {
      while (this.keepReading) {
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
          if (this.lastRead && this.lastRead.uid === cleaned && now - this.lastRead.at < DEDUPE_MS) continue;
          this.lastRead = { uid: cleaned, at: now };
          this.uidListeners.forEach((l) => { try { l(cleaned); } catch {} });
          try { window.dispatchEvent(new CustomEvent('web-serial-uid', { detail: cleaned })); } catch {}
        }
      }
    } catch (e: any) {
      exitReason = "o'qish xatosi: " + (e?.message || String(e));
    } finally {
      try { reader.releaseLock(); } catch {}
      await readableClosed;
      this.reader = null;
      if (this.keepReading) {
        this.appendLog('warn', `Uzildi: ${exitReason}`);
      }
      this.keepReading = false;
      this.update({ connected: false });
    }
  }

  async connect() {
    this.update({ error: null });
    // @ts-ignore
    if (!('serial' in navigator)) {
      const m = "Brauzer Web Serial'ni qo'llab-quvvatlamaydi.";
      this.update({ error: m });
      this.appendLog('error', m);
      return;
    }
    try {
      this.update({ connecting: true });
      this.appendLog('info', "Port tanlash so'ralmoqda...");
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      const ok = await this.openAndRead(port, "qo'lda ulanish");
      if (ok) {
        try { localStorage.setItem(AUTO_CONNECT_KEY, '1'); } catch {}
      } else {
        this.update({ connecting: false, error: "Port band — Arduino IDE Serial Monitor'ni yoping." });
      }
    } catch (e: any) {
      this.update({ connecting: false });
      const msg = e?.message || String(e);
      if (/No port selected|cancelled/i.test(msg)) {
        this.appendLog('info', 'Port tanlash bekor qilindi');
        return;
      }
      if (/in use|Failed to open/i.test(msg)) {
        const m = "Port band — Arduino IDE Serial Monitor'ni yoping.";
        this.update({ error: m });
        this.appendLog('error', m);
      } else {
        const m = "Ulanishda xatolik: " + msg;
        this.update({ error: m });
        this.appendLog('error', m);
      }
    }
  }

  async disconnect() {
    this.keepReading = false;
    try { localStorage.setItem(AUTO_CONNECT_KEY, '0'); } catch {}
    try {
      if (this.reader) {
        try { await this.reader.cancel(); } catch {}
        try { this.reader.releaseLock(); } catch {}
        this.reader = null;
      }
      if (this.port) {
        try { await this.port.close(); } catch {}
        this.port = null;
      }
    } finally {
      this.update({ connected: false, connecting: false });
      this.appendLog('info', "Foydalanuvchi uzdi (auto-ulanish o'chirildi)");
    }
  }
}

export const webSerialService = new WebSerialService();
