import { useCallback, useEffect, useState } from 'react';

const ENABLED_KEY = 'kiosk_enabled';
const PIN_KEY = 'kiosk_pin_hash';
const EVENT = 'kiosk-mode-change';

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin.trim()));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isKioskEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true';
}

export function getKioskPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export async function verifyKioskPin(pin: string): Promise<boolean> {
  const stored = getKioskPinHash();
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

export async function enableKiosk(pin: string) {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  localStorage.setItem(ENABLED_KEY, 'true');
  window.dispatchEvent(new Event(EVENT));
}

export function disableKiosk() {
  localStorage.setItem(ENABLED_KEY, 'false');
  window.dispatchEvent(new Event(EVENT));
}

/** Kiosk rejimi holatini kuzatuvchi hook */
export function useKioskMode() {
  const [enabled, setEnabled] = useState<boolean>(() => isKioskEnabled());

  useEffect(() => {
    const sync = () => setEnabled(isKioskEnabled());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const enable = useCallback(async (pin: string) => {
    await enableKiosk(pin);
  }, []);

  const disable = useCallback(() => {
    disableKiosk();
  }, []);

  return { enabled, enable, disable };
}
