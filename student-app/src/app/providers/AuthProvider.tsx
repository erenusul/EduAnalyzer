import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { login as loginRequest } from '../../services/api/authApi';
import { setUnauthorizedHandler } from '../../services/api/unauthorizedHandler';
import { clearStoredSession, getStoredSession, storeSession } from '../../services/storage/sessionStorage';
import type { Session, User } from '../../types/auth';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getStoredSession()
      .then((stored) => {
        if (mounted) {
          setSession(stored);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await clearStoredSession();
      setSession(null);
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    const role = response.user?.role;
    if (!role) {
      throw new Error('Giriş yanıtı geçersiz (rol bilgisi alınamadı).');
    }
    if (role !== 'Student') {
      throw new Error('Bu mobil uygulama sadece öğrenci hesapları için kullanılabilir.');
    }

    const nextSession: Session = {
      accessToken: response.accessToken,
      user: response.user,
    };

    await storeSession(nextSession);
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    await clearStoredSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.accessToken),
    isLoading,
    login,
    logout,
  }), [isLoading, login, logout, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
