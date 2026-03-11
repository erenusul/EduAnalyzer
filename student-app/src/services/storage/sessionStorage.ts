import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '../../types/auth';

const SESSION_KEY = 'eduanalyzer_student_session';

export async function getStoredSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
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
