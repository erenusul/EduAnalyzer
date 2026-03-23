import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExamResult } from '../../types/exam';

const CACHE_KEY = 'eduanalyzer_student_results_cache_v1';

interface CachedPayload {
  savedAt: number;
  results: ExamResult[];
}

export async function saveResultsCache(results: ExamResult[]): Promise<void> {
  const payload: CachedPayload = { savedAt: Date.now(), results };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

export async function loadResultsCache(): Promise<CachedPayload | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedPayload;
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export async function clearResultsCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
