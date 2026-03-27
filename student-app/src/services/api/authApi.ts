import { apiPost } from './apiClient';
import type { LoginResponse, User, UserRole } from '../../types/auth';

function readString(obj: Record<string, unknown>, camel: string, pascal: string): string {
  const v = obj[camel] ?? obj[pascal];
  return typeof v === 'string' ? v : v != null ? String(v) : '';
}

/** Bazı proxy / eski API sürümleri gövdeyi `data` içinde döndürebilir. */
function unwrapLoginRoot(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const r = raw as Record<string, unknown>;
  const nested = r.data ?? r.Data ?? r.result ?? r.Result ?? r.payload ?? r.Payload;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...r, ...(nested as Record<string, unknown>) };
  }
  return r;
}

function pickUserObject(r: Record<string, unknown>): Record<string, unknown> | null {
  const candidates = [r.user, r.User, r.profile, r.Profile, r.account, r.Account];
  for (const u of candidates) {
    if (u && typeof u === 'object' && !Array.isArray(u)) {
      return u as Record<string, unknown>;
    }
  }
  return null;
}

function pickAccessToken(r: Record<string, unknown>): string {
  const fromStandard = readString(r, 'accessToken', 'AccessToken').trim();
  if (fromStandard) {
    return fromStandard;
  }
  const snake = readString(r, 'access_token', 'Access_token').trim();
  if (snake) {
    return snake;
  }
  const tokenOnly = readString(r, 'token', 'Token').trim();
  if (tokenOnly && !tokenOnly.includes('@')) {
    return tokenOnly;
  }
  return '';
}

/**
 * Bazı ortamlarda JSON alanları PascalCase gelebilir; kullanıcı nesnesi eksikse güvenli hata verir.
 */
function normalizeLoginResponse(raw: unknown): LoginResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Giriş yanıtı geçersiz (sunucu cevabı boş veya hatalı biçim).');
  }
  const r = unwrapLoginRoot(raw);
  const userRaw = pickUserObject(r);
  if (!userRaw) {
    const keys = Object.keys(r).join(', ');
    throw new Error(
      keys
        ? `Giriş yanıtı eksik: kullanıcı bilgisi yok (alanlar: ${keys}). EduAnalyzer API (5131) kullanıldığından emin olun.`
        : 'Giriş yanıtı eksik: kullanıcı bilgisi yok.'
    );
  }

  const roleStr = readString(userRaw, 'role', 'Role').trim();
  if (!roleStr) {
    throw new Error('Giriş yanıtı eksik: kullanıcı rolü yok.');
  }

  const user: User = {
    id: readString(userRaw, 'id', 'Id'),
    email: readString(userRaw, 'email', 'Email'),
    displayName: readString(userRaw, 'displayName', 'DisplayName'),
    role: roleStr as UserRole,
  };

  const accessToken = pickAccessToken(r);
  if (!accessToken) {
    throw new Error('Giriş yanıtı eksik: oturum anahtarı (accessToken) yok.');
  }

  return {
    accessToken,
    tokenType: readString(r, 'tokenType', 'TokenType') || readString(r, 'token_type', 'Token_type') || 'Bearer',
    expiresAt: readString(r, 'expiresAt', 'ExpiresAt') || readString(r, 'expires_at', 'Expires_at'),
    user,
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const raw = await apiPost<unknown>('/api/auth/login', { email, password }, { skipAuth: true });
  return normalizeLoginResponse(raw);
}
