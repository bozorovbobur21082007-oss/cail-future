import { useEffect, useState } from 'react';

const STORAGE_KEY = 'scanner_gun_mode';

const readInitial = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * "Skaner gun rejimi" — yoqilganda kamera/NFC tugmalari yashirinadi va
 * skanerlash inputlariga avtomatik fokus beriladi (USB skaner gun uchun).
 * Holat localStorage'da saqlanadi va barcha sahifalar bo'ylab sinxronlanadi.
 */
export function useScannerMode(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readInitial);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(e.newValue === '1');
    };
    const customHandler = () => setEnabled(readInitial());
    window.addEventListener('storage', handler);
    window.addEventListener('scanner-mode-changed', customHandler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('scanner-mode-changed', customHandler);
    };
  }, []);

  const set = (v: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      // ignore
    }
    setEnabled(v);
    window.dispatchEvent(new Event('scanner-mode-changed'));
  };

  return [enabled, set];
}
