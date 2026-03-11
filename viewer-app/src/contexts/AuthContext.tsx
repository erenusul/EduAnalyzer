/**
 * Auth Context - Backend API ile giriş
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { AuthContextValue, User } from '../types/auth';
import { authApi } from '../services/backendApi';

const STORAGE_KEY = 'eduanalyzer_teacher_session';

interface StoredSession {
  accessToken: string;
  user: User;
}

function loadStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredSession;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(loadStoredSession);
  const user = session?.user ?? null;

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    try {
      const res = await authApi.login(email, password);
      const userData: User = {
        id: res.user.id,
        email: res.user.email,
        displayName: res.user.displayName,
        role: res.user.role as User['role'],
      };
      const sessionData: StoredSession = {
        accessToken: res.accessToken,
        user: userData,
      };
      setSession(sessionData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      return userData;
    } catch {
      return null;
    }
  }, []);

  const loginDemo = useCallback(async () => {
    return login('ogretmen@demo.com', 'demo123');
  }, [login]);

  const loginDemoStudent = useCallback(async () => {
    return login('ogrenci@demo.com', 'demo123');
  }, [login]);

  const loginDemoParent = useCallback(async () => {
    return login('veli@demo.com', 'demo123');
  }, [login]);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    login,
    loginDemo,
    loginDemoStudent,
    loginDemoParent,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
