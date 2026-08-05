import { useEffect, useState } from 'react';
import logoMark from '@/assets/baht-mark.png';
import logoWordmark from '@/assets/baht-wordmark.png';

const SESSION_KEY = 'baht_intro_shown';

/**
 * BAHT TEXTILE ochilish animatsiyasi.
 * Belgi aylanib chiqadi, so'ng yozuv ochiladi va ekran so'nadi.
 */
export default function BrandIntro() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    const t1 = setTimeout(() => setLeaving(true), 2300);
    const t2 = setTimeout(() => setVisible(false), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[hsl(28,60%,96%)] ${
        leaving ? 'brand-intro-out' : ''
      }`}
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <img
          src={logoMark}
          alt=""
          className="brand-intro-mark h-16 w-16 sm:h-24 sm:w-24 object-contain"
        />
        <img
          src={logoWordmark}
          alt=""
          className="brand-intro-word h-12 sm:h-20 w-auto object-contain"
        />
      </div>
    </div>
  );
}
