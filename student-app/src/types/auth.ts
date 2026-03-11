export type UserRole = 'Teacher' | 'Student' | 'Parent';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: User;
}

export interface Session {
  accessToken: string;
  user: User;
}
