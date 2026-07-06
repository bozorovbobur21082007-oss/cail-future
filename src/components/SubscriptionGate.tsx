import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, KeyRound, LogOut, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const DEV_CODE = '21082007Bb';
const SETTING_KEY = 'subscription_expires_at';

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [devCode, setDevCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [extending, setExtending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle();
    if (data?.value) {
      const d = new Date(data.value);
      setExpiresAt(isNaN(d.getTime()) ? null : d);
    } else {
      setExpiresAt(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const expired = expiresAt !== null && expiresAt.getTime() <= now.getTime();

  const tryUnlock = () => {
    if (devCode === DEV_CODE) {
      setUnlocked(true);
      setDevCode('');
    } else {
      toast.error("Kod noto'g'ri");
    }
  };

  const extendSixMonths = async () => {
    setExtending(true);
    const base = expiresAt && expiresAt > new Date() ? expiresAt : new Date();
    const next = new Date(base);
    next.setMonth(next.getMonth() + 6);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: next.toISOString() })
      .eq('key', SETTING_KEY);
    setExtending(false);
    if (error) {
      toast.error("Uzaytirishda xatolik: " + error.message);
      return;
    }
    setExpiresAt(next);
    setUnlocked(false);
    toast.success("Muddat 6 oyga uzaytirildi");
  };

  if (loading) return <>{children}</>;
  if (!expired) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-destructive/40">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-destructive" />
          </div>
          <CardTitle>Foydalanish muddati tugagan</CardTitle>
          <CardDescription>
            Ushbu tizimdan foydalanish muddati{' '}
            <span className="font-semibold text-foreground">
              {expiresAt?.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>{' '}
            sanasida tugagan. Ishlashda davom etish uchun dasturchi bilan bog'laning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!unlocked ? (
            <div className="space-y-2">
              <Label htmlFor="gate-code" className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Dasturchi kodi
              </Label>
              <div className="flex gap-2">
                <Input
                  id="gate-code"
                  type={showCode ? 'text' : 'password'}
                  value={devCode}
                  onChange={(e) => setDevCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
                  placeholder="Kodni kiriting"
                  className="font-mono"
                  autoFocus
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowCode(v => !v)}>
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button onClick={tryUnlock} disabled={!devCode.trim()}>Kirish</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-primary">
                Dasturchi rejimi tasdiqlandi. Muddatni 6 oyga uzaytiring.
              </div>
              <Button onClick={extendSixMonths} disabled={extending} className="w-full gap-2">
                {extending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                6 oyga uzaytirish
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={logout} className="w-full gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" />
            Chiqish
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
