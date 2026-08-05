import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Warehouse, Loader2, ScanLine, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import InstallPwaButton from '@/components/InstallPwaButton';

type Mode = 'choose' | 'admin' | 'worker';

export default function LoginPage() {
  const { login, signup, loginAsWorker } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('choose');
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, name);
        await login(email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await loginAsWorker(pin);
      navigate('/operatsiyalar');
    } catch (err: any) {
      setError(err.message || "Noto'g'ri PIN");
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-background bg-cover bg-center relative"
      style={{ backgroundImage: `url(${bgTextile})` }}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      <Card className="w-full max-w-md border-border shadow-2xl relative z-10 bg-card/95">
        <CardHeader className="text-center pb-2">
          <BrandLogo className="mx-auto h-14 w-auto object-contain mb-4" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            Aqlli Omborxona
          </CardTitle>
          <CardDescription>
            {mode === 'choose' && 'Kirish turini tanlang'}
            {mode === 'admin' && (isSignup ? "Yangi admin hisobi yaratish" : "Admin sifatida kirish")}
            {mode === 'worker' && "Ishchi PIN kodini kiriting"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {error}
            </div>
          )}

          {mode === 'choose' && (
            <div className="space-y-3">
              <Button
                className="w-full h-14 justify-start gap-3 text-base"
                onClick={() => { setMode('worker'); setError(''); }}
              >
                <ScanLine className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold">Ishchi sifatida kirish</div>
                  <div className="text-xs opacity-80 font-normal">PIN kod orqali — Kirim/Chiqim</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 justify-start gap-3 text-base"
                onClick={() => { setMode('admin'); setError(''); }}
              >
                <Warehouse className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold">Admin sifatida kirish</div>
                  <div className="text-xs text-muted-foreground font-normal">Email va parol orqali</div>
                </div>
              </Button>
            </div>
          )}

          {mode === 'worker' && (
            <form onSubmit={handleWorkerSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN kod</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-2xl tracking-widest h-14"
                  maxLength={12}
                  required
                />
                <p className="text-xs text-muted-foreground text-center">
                  PIN ni administratordan oling
                </p>
              </div>
              <Button type="submit" className="w-full h-12" disabled={loading || !pin.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? 'Tekshirilmoqda...' : 'Kirish'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setMode('choose'); setError(''); setPin(''); }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Orqaga
              </Button>
            </form>
          )}

          {mode === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="name">Ism</Label>
                  <Input id="name" type="text" placeholder="Ismingiz"
                    value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="admin@omborxona.uz"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input id="password" type="password" placeholder="Parol"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? (isSignup ? "Yaratilmoqda..." : "Kirilmoqda...") : (isSignup ? "Ro'yxatdan o'tish" : "Kirish")}
              </Button>
              <div>
                <button
                  type="button"
                  onClick={() => { setMode('choose'); setError(''); }}
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Orqaga
                </button>
              </div>

            </form>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-center">
        <InstallPwaButton />
      </div>
    </div>
  );
}
