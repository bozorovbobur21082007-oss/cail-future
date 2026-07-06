import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

type Role = 'admin' | 'worker' | null;

interface AuthContextType {
  user: AuthUser | null;
  role: Role;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginAsWorker: (pin: string) => Promise<void>;
  setWorkerName: (name: string) => void;
  /** Read-only accessor for the current worker session token (used when
   * calling worker-action edge function). Null for non-worker sessions. */
  getWorkerToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const WORKER_TOKEN_KEY = 'worker_session_token';
const WORKER_NAME_KEY = 'worker_name';

// Client-side sanity check: is the stored token structurally valid and unexpired?
// Server always re-verifies signatures, but this avoids obviously-dead sessions.
function decodeExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const pad = 4 - (parts[1].length % 4 || 4);
    const norm = parts[1].replace(/-/g, '+').replace(/_/g, '/') + (pad < 4 ? '='.repeat(pad) : '');
    const payload = JSON.parse(atob(norm));
    return typeof payload?.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (session: Session | null) => {
    if (!session?.user) {
      // Worker session? Validate signed token server-side.
      const token = sessionStorage.getItem(WORKER_TOKEN_KEY);
      if (token) {
        const exp = decodeExp(token);
        if (exp && exp * 1000 > Date.now()) {
          try {
            const { data } = await supabase.functions.invoke('verify-worker-session', { body: { token } });
            if (data?.valid) {
              const savedName = sessionStorage.getItem(WORKER_NAME_KEY) || 'Ishchi';
              setUser({ id: 'worker', email: '', name: savedName });
              setRole('worker');
              setLoading(false);
              return;
            }
          } catch { /* fall through to signed-out */ }
        }
        sessionStorage.removeItem(WORKER_TOKEN_KEY);
        sessionStorage.removeItem(WORKER_NAME_KEY);
      }
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', session.user.id)
      .single();

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: session.user.id,
      _role: 'admin',
    });

    setUser({
      id: session.user.id,
      email: data?.email || session.user.email || '',
      name: data?.name || '',
    });
    setRole(isAdmin ? 'admin' : null);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    sessionStorage.removeItem(WORKER_TOKEN_KEY);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (_email: string, _password: string, _name: string) => {
    throw new Error(
      "Ro'yxatdan o'tish yopiq. Yangi admin qo'shish uchun mavjud admin bilan bog'laning.",
    );
  };

  const loginAsWorker = async (pin: string) => {
    const { data, error } = await supabase.functions.invoke('verify-worker-pin', {
      body: { pin },
    });
    if (error) throw new Error('Server bilan aloqa xatosi');
    if (!data?.valid || !data?.token) throw new Error("Noto'g'ri PIN kod");

    sessionStorage.setItem(WORKER_TOKEN_KEY, data.token);
    setUser({ id: 'worker', email: '', name: 'Ishchi' });
    setRole('worker');
    setLoading(false);
  };

  const logout = async () => {
    sessionStorage.removeItem(WORKER_TOKEN_KEY);
    sessionStorage.removeItem(WORKER_NAME_KEY);
    if (role === 'admin') {
      await supabase.auth.signOut();
    }
    setUser(null);
    setRole(null);
  };

  const setWorkerName = (name: string) => {
    if (!name) return;
    sessionStorage.setItem(WORKER_NAME_KEY, name);
    setUser((prev) => (prev ? { ...prev, name } : prev));
  };

  const getWorkerToken = () => sessionStorage.getItem(WORKER_TOKEN_KEY);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, signup, loginAsWorker, setWorkerName, getWorkerToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
