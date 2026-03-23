import { apiGet } from './apiClient';
import type { AvailableExam, ExamResult } from '../../types/exam';
import { loadResultsCache, saveResultsCache } from '../storage/resultsCache';

export function getMyResults(): Promise<ExamResult[]> {
  return apiGet<ExamResult[]>('/api/me/results');
}

export function getMyAvailableExams(): Promise<AvailableExam[]> {
  return apiGet<AvailableExam[]>('/api/me/exams');
}

export interface LoadResultsOutcome {
  results: ExamResult[];
  fromCache: boolean;
  cacheAgeMs: number | null;
}

/**
 * Önce API dener; ağ hatasında son başarılı önbelleği döndürür.
 */
export async function getMyResultsWithOfflineFallback(): Promise<LoadResultsOutcome> {
  try {
    const results = await getMyResults();
    await saveResultsCache(results);
    return { results, fromCache: false, cacheAgeMs: null };
  } catch (err) {
    const cached = await loadResultsCache();
    if (cached && cached.results.length > 0) {
      return {
        results: cached.results,
        fromCache: true,
        cacheAgeMs: Date.now() - cached.savedAt,
      };
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Sonuçlar yüklenemedi.');
  }
}
