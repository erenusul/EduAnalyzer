/**
 * Auth ile ilgili tip tanımları
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  loginDemo: () => void;
  logout: () => void;
}
