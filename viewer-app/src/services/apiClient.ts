/**
 * Backend API HTTP client - JWT auth, error handling
 */

type UnauthorizedHandler = () => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** AuthProvider kaydeder; 401 yanıtında oturum temizlenir (döngüsel import yok). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

async function notifyUnauthorized(): Promise<void> {
  if (unauthorizedHandler) {
    await unauthorizedHandler();
  }
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? '/backend' : 'http://localhost:5131');

export interface ApiError {
  message: string;
  status: number;
}

async function getToken(): Promise<string | null> {
  try {
    const stored = localStorage.getItem('eduanalyzer_teacher_session');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

function buildUrl(path: string): string {
  const base = BACKEND_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = buildUrl(path);
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
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
      /* body okunamadı, varsayılan message kullan */
    }
    if (response.status === 401) {
      message = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
      await notifyUnauthorized();
    }
    if (response.status === 403) {
      message = 'Oturum geçersiz. Lütfen tekrar giriş yapın.';
    }
    throw { message, status: response.status } as ApiError;
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' });
}

export async function apiUpload<T>(
  path: string,
  file: File,
  params?: Record<string, string>
): Promise<T> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', file);
  if (params) {
    Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  }

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const body = JSON.parse(text) as { message?: string };
          message = body.message ?? message;
        } catch {
          message = text;
        }
      }
    } catch {
      /* body okunamadı */
    }
    if (response.status === 401) {
      await notifyUnauthorized();
    }
    throw { message, status: response.status } as ApiError;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiUploadFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
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
      /* body okunamadı */
    }
    if (response.status === 401) {
      await notifyUnauthorized();
    }
    throw { message, status: response.status } as ApiError;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
