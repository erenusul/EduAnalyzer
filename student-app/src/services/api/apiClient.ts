import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getStoredSession } from '../storage/sessionStorage';
import { notifyUnauthorized } from './unauthorizedHandler';

export interface ApiError extends Error {
  message: string;
  status: number;
}

const DEFAULT_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5131',
  default: 'http://localhost:5131',
});

function resolveRequestTimeoutMs(): number {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS?.trim();
  if (!raw) {
    return 30_000;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}

/** Optik yükleme + ML işlemi uzun sürebilir */
function resolveUploadTimeoutMs(): number {
  const raw = process.env.EXPO_PUBLIC_UPLOAD_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 120_000;
}

const REQUEST_TIMEOUT_MS = resolveRequestTimeoutMs();
const UPLOAD_TIMEOUT_MS = resolveUploadTimeoutMs();

function normalizeBaseUrl(value?: string | null): string | null {
  const normalized = value?.trim().replace(/\/$/, '');
  return normalized ? normalized : null;
}

function getExpoDevServerHost(): string | null {
  const sourceCode = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode;
  const scriptUrl = sourceCode?.scriptURL;
  if (!scriptUrl) {
    return null;
  }

  const match = scriptUrl.match(/^https?:\/\/([^/:]+)/i);
  return match?.[1] ?? null;
}

/**
 * Metro / Expo CLI bazen host'u expoConfig.hostUri içinde verir (ör. 192.168.1.7:8081).
 */
function getDevHostFromExpoConfig(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri || typeof hostUri !== 'string') {
    return null;
  }
  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  return host;
}

/**
 * exp://192.168.x.x:8081 veya benzeri — fiziksel iPhone + Expo Go için Metro IP sık burada bulunur.
 */
function parseHostFromBundleUri(uri: string | null | undefined): string | null {
  if (!uri || typeof uri !== 'string') {
    return null;
  }
  const match = uri.match(/^(?:exp|exps|http|https):\/\/([^/:?#]+)/i);
  const host = match?.[1]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  return host;
}

function resolveLanDevBackendUrl(): string | null {
  const candidates: Array<string | null | undefined> = [
    getExpoDevServerHost(),
    getDevHostFromExpoConfig(),
    parseHostFromBundleUri(Constants.experienceUrl),
    parseHostFromBundleUri(Constants.linkingUri),
  ];

  for (const h of candidates) {
    if (h && h !== 'localhost' && h !== '127.0.0.1') {
      return `http://${h}:5131`;
    }
  }
  return null;
}

/**
 * EXPO_PUBLIC_BACKEND_URL yoksa Metro ile aynı makinedeki backend’e (5131) bağlanır.
 * Fiziksel telefonda `localhost` kullanılmaz: iPhone’da localhost = telefonun kendisi, Mac’teki API’ye gitmez.
 *
 * Simülatör / emülatör: .env’deki LAN veya VPN IP’si (ör. 10.242.x.x) genelde simülatörden erişilemez;
 * bu yüzden önce localhost / 10.0.2.2 kullanılır. Fiziksel cihazda EXPO_PUBLIC_BACKEND_URL geçerlidir.
 */
export function resolveApiBaseUrl(): string {
  const envBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL);
  const iosSimOverride = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL_IOS_SIMULATOR);
  const androidEmuOverride = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL_ANDROID_EMULATOR);

  if (Platform.OS === 'ios' && !Device.isDevice) {
    if (iosSimOverride) {
      return iosSimOverride;
    }
    return 'http://localhost:5131';
  }

  if (Platform.OS === 'android' && !Device.isDevice) {
    if (androidEmuOverride) {
      return androidEmuOverride;
    }
    return 'http://10.0.2.2:5131';
  }

  if (envBaseUrl) {
    if (
      Device.isDevice &&
      (envBaseUrl.includes('localhost') ||
        envBaseUrl.includes('127.0.0.1') ||
        envBaseUrl.includes('10.0.2.2'))
    ) {
      console.warn(
        '[EduAnalyzer] EXPO_PUBLIC_BACKEND_URL fiziksel telefonda Mac’e işaret etmiyor. Mac’in yerel IP’sini kullanın (örn. http://192.168.1.10:5131). localhost ve 10.0.2.2 telefonda Mac değildir.'
      );
    }
    return envBaseUrl;
  }

  const lanUrl = resolveLanDevBackendUrl();
  if (lanUrl) {
    return lanUrl;
  }

  if (Device.isDevice) {
    console.warn(
      '[EduAnalyzer] Backend adresi otomatik bulunamadı. Mac’te terminalde `ipconfig getifaddr en0` (veya Sistem Ayarları > Ağ) ile IP alın; student-app/.env içine EXPO_PUBLIC_BACKEND_URL=http://<BU_IP>:5131 yazıp Metro’yu yeniden başlatın. iPhone ile Mac aynı Wi‑Fi’de olmalı.'
    );
  }

  return DEFAULT_BASE_URL || 'http://localhost:5131';
}

function buildUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${normalized}`;
}

export interface ApiRequestOptions {
  /** Giriş gibi anonim isteklerde eski Bearer token gönderilmez. */
  skipAuth?: boolean;
}

async function buildHeaders(
  extraHeaders?: HeadersInit,
  isJson: boolean = true,
  skipAuth = false
): Promise<Record<string, string>> {
  const session = await getStoredSession();
  const headers: Record<string, string> = {
    ...(isJson ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string> | undefined),
  };

  if (!skipAuth && session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return headers;
}

function isAuthLoginPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized === '/api/auth/login';
}

function isGenericHttpStatusMessage(message: string, status: number): boolean {
  return message === `HTTP ${status}` || !message.trim();
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `HTTP ${response.status}`;

  try {
    const text = await response.text();
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: string; detail?: string; title?: string };
        message = body.message ?? body.detail ?? body.title ?? message;
      } catch {
        message = text;
      }
    }
  } catch {
    // ignore parsing errors
  }

  if (response.status === 401) {
    if (isGenericHttpStatusMessage(message, 401)) {
      message = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
    }
  }

  if (response.status === 403) {
    if (isGenericHttpStatusMessage(message, 403)) {
      message = 'Bu işlem için yetkiniz bulunmuyor.';
    }
  }

  const err = new Error(message) as ApiError;
  err.status = response.status;
  err.name = 'ApiError';
  return err;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
}

function formatNetworkFailureMessage(err: unknown): string {
  const base =
    'Mac’te backend çalışıyor olmalı (port 5131). iPhone ile Mac aynı Wi‑Fi’de olmalı. Telefonda localhost Mac’e gitmez: student-app/.env dosyasına EXPO_PUBLIC_BACKEND_URL=http://<Mac’in_YEREL_IP>:5131 yazıp Metro’yu (npx expo start --clear) yeniden başlatın.';
  if (__DEV__ && err instanceof Error && err.message) {
    return `${base} (${err.message})`;
  }
  return base;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (isAbortError(err)) {
      const timeoutErr = new Error(
        `İstek zaman aşımına uğradı (${Math.round(timeoutMs / 1000)} sn). Bağlantınızı kontrol edip tekrar deneyin.`
      ) as ApiError;
      timeoutErr.status = 0;
      timeoutErr.name = 'ApiError';
      throw timeoutErr;
    }
    const netErr = new Error(formatNetworkFailureMessage(err)) as ApiError;
    netErr.status = 0;
    netErr.name = 'ApiError';
    throw netErr;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  isJson: boolean = true,
  apiOpts?: ApiRequestOptions
): Promise<T> {
  const response = await fetchWithTimeout(
    buildUrl(path),
    {
      ...options,
      headers: await buildHeaders(options.headers, isJson, apiOpts?.skipAuth === true),
    },
    REQUEST_TIMEOUT_MS
  );

  if (response.status === 401) {
    if (!isAuthLoginPath(path)) {
      await notifyUnauthorized();
    }
    throw await parseError(response);
  }

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

export function apiPost<T>(path: string, body?: unknown, apiOpts?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    },
    true,
    apiOpts
  );
}

export function apiPatch<T>(path: string, body?: unknown, apiOpts?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    },
    true,
    apiOpts
  );
}

export function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' });
}

export async function apiUploadFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetchWithTimeout(
    buildUrl(path),
    {
      method: 'POST',
      body: formData,
      headers: await buildHeaders(undefined, false),
    },
    UPLOAD_TIMEOUT_MS
  );

  if (response.status === 401) {
    await notifyUnauthorized();
    throw await parseError(response);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
