import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Warehouse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, name);
        // After signup, auto-login
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Warehouse className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Aqlli Omborxona
          </CardTitle>
          <CardDescription>
            {isSignup ? "Yangi hisob yaratish" : "Tizimga kirish uchun ma'lumotlaringizni kiriting"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Ism</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ismingizni kiriting"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@omborxona.uz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input
                id="password"
                type="password"
                placeholder="Parolni kiriting"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? (isSignup ? "Yaratilmoqda..." : "Kirilmoqda...") : (isSignup ? "Ro'yxatdan o'tish" : "Kirish")}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              className="text-sm text-primary hover:underline"
            >
              {isSignup ? "Hisobingiz bormi? Kirish" : "Hisobingiz yo'qmi? Ro'yxatdan o'tish"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
