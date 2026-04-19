import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sound-feedback-enabled';

export function useSoundEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    window.dispatchEvent(new Event('sound-feedback-changed'));
  }, [enabled]);

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      setEnabled(saved === null ? true : saved === 'true');
    };
    window.addEventListener('sound-feedback-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('sound-feedback-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return [enabled, setEnabled];
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playBeep(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? true : saved === 'true';
}

export function useSoundFeedback() {
  const success = useCallback(() => {
    if (!isEnabled()) return;
    playBeep(880, 0.12, 'sine', 0.18);
  }, []);

  const error = useCallback(() => {
    if (!isEnabled()) return;
    playBeep(220, 0.25, 'square', 0.15);
  }, []);

  const test = useCallback(() => {
    playBeep(880, 0.12, 'sine', 0.18);
  }, []);

  return { success, error, test };
}
