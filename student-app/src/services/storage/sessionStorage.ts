import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '../../types/auth';

const SESSION_KEY = 'eduanalyzer_student_session';

function isCompleteSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const s = value as Record<string, unknown>;
  const token = s.accessToken;
  const user = s.user as Record<string, unknown> | undefined;
  if (typeof token !== 'string' || !token.trim()) {
    return false;
  }
  if (!user || typeof user !== 'object') {
    return false;
  }
  const role = user.role;
  return typeof role === 'string' && role.trim().length > 0;
}

export async function getStoredSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isCompleteSession(parsed)) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function storeSession(session: Session): Promise<void> {
  return AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): Promise<void> {
  return AsyncStorage.removeItem(SESSION_KEY);
}
