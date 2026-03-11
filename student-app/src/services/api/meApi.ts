import { apiGet } from './apiClient';
import type { AvailableExam, ExamResult } from '../../types/exam';

export function getMyResults(): Promise<ExamResult[]> {
  return apiGet<ExamResult[]>('/api/me/results');
}

export function getMyAvailableExams(): Promise<AvailableExam[]> {
  return apiGet<AvailableExam[]>('/api/me/exams');
}
