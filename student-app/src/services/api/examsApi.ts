import { apiUploadFormData } from './apiClient';
import type { ScanExamResponse } from '../../types/exam';

export function submitScan(examId: string, photoUri: string, questionCount?: number): Promise<ScanExamResponse> {
  const formData = new FormData();
  formData.append('file', {
    uri: photoUri,
    name: 'optik-form.jpg',
    type: 'image/jpeg',
  } as never);

  if (questionCount != null) {
    formData.append('questionCount', String(questionCount));
  }

  return apiUploadFormData<ScanExamResponse>(`/api/me/exams/${examId}/submit-scan`, formData);
}
