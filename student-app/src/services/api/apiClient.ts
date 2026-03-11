import { Platform } from 'react-native';
import { getStoredSession } from '../storage/sessionStorage';

export interface ApiError {
  message: string;
  status: number;
}

const DEFAULT_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5131',
  default: 'http://localhost:5131',
});

const API_BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BASE_URL || '').replace(/\/$/, '');

function buildUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

async function buildHeaders(extraHeaders?: HeadersInit, isJson: boolean = true): Promise<Record<string, string>> {
  const session = await getStoredSession();
  const headers: Record<string, string> = {
    ...(isJson ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string> | undefined),
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return headers;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `HTTP ${response.status}`;

  try {
    const text = await response.text();
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: string; detail?: string };
        message = body.message ?? body.detail ?? message;
      } catch {
        message = text;
      }
    }
  } catch {
    // ignore parsing errors
  }

  if (response.status === 401) {
    message = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
  }

  if (response.status === 403) {
    message = 'Bu işlem için yetkiniz bulunmuyor.';
  }

  return { message, status: response.status };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, isJson: boolean = true): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: await buildHeaders(options.headers, isJson),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiUploadFormData<T>(path: string, formData: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: formData,
  }, false);
}
