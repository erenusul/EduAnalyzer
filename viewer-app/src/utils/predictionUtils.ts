/**
 * Tahmin sonuçları için yardımcı fonksiyonlar
 */

import type { SubjectCode } from '../config/constants';
import { SUBJECTS } from '../config/constants';

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function getSubjectName(subjectCode: string): string {
  return SUBJECTS[subjectCode as SubjectCode] ?? subjectCode;
}
