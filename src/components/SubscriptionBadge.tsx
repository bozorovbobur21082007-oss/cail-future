import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SubscriptionBadge() {
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key,value')
        .in('key', ['subscription_expires_at', 'subscription_enabled']);
      if (!mounted) return;
      const map = new Map((data || []).map((r: any) => [r.key, r.value]));
      setEnabled(map.get('subscription_enabled') === 'true');
      const raw = map.get('subscription_expires_at') as string | undefined;
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) setExpiresAt(d);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!enabled || !expiresAt) return null;

  const msLeft = expiresAt.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86400000);
  const expired = msLeft <= 0;
  const warn = !expired && daysLeft <= 14;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border',
        expired
          ? 'bg-destructive/10 text-destructive border-destructive/30'
          : warn
          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
          : 'bg-primary/5 text-primary border-primary/20'
      )}
      title={`Amal qilish muddati: ${expiresAt.toLocaleDateString('uz-UZ')}`}
    >
      {expired ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">
        {expired ? 'Muddat tugagan' : `${daysLeft} kun qoldi`}
      </span>
      <span className="sm:hidden">
        {expired ? '!' : `${daysLeft}k`}
      </span>
    </div>
  );
}
