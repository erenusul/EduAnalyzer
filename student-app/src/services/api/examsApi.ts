import { apiUploadFormData } from './apiClient';
import type { ScanExamResponse } from '../../types/exam';

export function submitScan(
  examId: string,
  photoUri: string,
  questionCount?: number,
  optionCount?: number
): Promise<ScanExamResponse> {
  const formData = new FormData();
  formData.append('file', {
    uri: photoUri,
    name: 'optik-form.jpg',
    type: 'image/jpeg',
  } as never);

  if (questionCount != null) {
    formData.append('questionCount', String(questionCount));
  }

  if (optionCount != null) {
    formData.append('optionCount', String(optionCount));
  }

  return apiUploadFormData<ScanExamResponse>(`/api/me/exams/${examId}/submit-scan`, formData);
}

export function getOptionCountFromAnswerKey(answerKey?: string[] | null): number {
  if (!answerKey?.length) return 5;
  const hasE = answerKey.some((a) => /^E$/i.test((a ?? '').trim()));
  return hasE ? 5 : 4;
}
