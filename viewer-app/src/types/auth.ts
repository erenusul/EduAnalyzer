/**
 * Auth ile ilgili tip tanımları
 */

export type UserRole = 'Teacher' | 'Student' | 'Parent';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role?: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User | null>;
  loginDemo: () => Promise<User | null>;
  loginDemoParent: () => Promise<User | null>;
  logout: () => void;
}
