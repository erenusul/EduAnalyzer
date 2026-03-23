import { apiPost } from './apiClient';
import type { LoginResponse } from '../../types/auth';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', { email, password }, { skipAuth: true });
}
