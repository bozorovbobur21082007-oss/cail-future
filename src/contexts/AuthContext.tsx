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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const WORKER_FLAG_KEY = 'worker_session';
const WORKER_NAME_KEY = 'worker_name';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (session: Session | null) => {
    if (!session?.user) {
      // Check if worker session is active
      const isWorker = sessionStorage.getItem(WORKER_FLAG_KEY) === '1';
      if (isWorker) {
        const savedName = sessionStorage.getItem(WORKER_NAME_KEY) || 'Ishchi';
        setUser({ id: 'worker', email: '', name: savedName });
        setRole('worker');
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', session.user.id)
      .single();

    // Server-side role check via user_roles table (RLS-protected)
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
    sessionStorage.removeItem(WORKER_FLAG_KEY);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const loginAsWorker = async (pin: string) => {
    const { data, error } = await supabase.functions.invoke('verify-worker-pin', {
      body: { pin },
    });
    if (error) throw new Error('Server bilan aloqa xatosi');
    if (!data?.valid) throw new Error("Noto'g'ri PIN kod");

    sessionStorage.setItem(WORKER_FLAG_KEY, '1');
    setUser({ id: 'worker', email: '', name: 'Ishchi' });
    setRole('worker');
    setLoading(false);
  };

  const logout = async () => {
    sessionStorage.removeItem(WORKER_FLAG_KEY);
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

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, signup, loginAsWorker, setWorkerName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
