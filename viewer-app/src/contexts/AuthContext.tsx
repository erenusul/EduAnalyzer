/**
 * Mock öğretmen girişi için Auth Context
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { AuthContextValue, User } from '../types/auth';

const STORAGE_KEY = 'eduanalyzer_teacher_session';
const DEMO_USER: User = {
  id: 'demo-1',
  email: 'ogretmen@demo.com',
  displayName: 'Demo Öğretmen',
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (email === 'ogretmen@demo.com' && password === 'demo123') {
      const loggedUser: User = {
        ...DEMO_USER,
        email,
        displayName: email.split('@')[0],
      };
      setUser(loggedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
      return true;
    }
    return false;
  }, []);

  const loginDemo = useCallback(() => {
    setUser(DEMO_USER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_USER));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    login,
    loginDemo,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
