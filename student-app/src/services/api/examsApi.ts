import { apiUploadFormData } from './apiClient';
import type { ScanExamResponse } from '../../types/exam';

/** 212×300 mm A4, yalnızca Türkçe 20×4 mm şablonu (ML tarafıyla aynı kimlik). */
export const OPTICAL_TEMPLATE_LGS_TURKISH_212X300 = 'lgs_turkish_212x300';

/** 117×107 mm SÖZEL kırpıntısı: 4 sütun × 20 satır (ML ile aynı kimlik). Kadraj bu alanı doldurmalı. */
export const OPTICAL_TEMPLATE_LGS_SOZEL_CROP_117X107 = 'lgs_sozel_crop_117x107';

export function submitScan(
  examId: string,
  photoUri: string,
  questionCount?: number,
  optionCount?: number,
  opticalTemplate?: string
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

  if (opticalTemplate) {
    formData.append('opticalTemplate', opticalTemplate);
  }

  return apiUploadFormData<ScanExamResponse>(`/api/me/exams/${examId}/submit-scan`, formData);
}

export function getOptionCountFromAnswerKey(answerKey?: string[] | null): number {
  if (!answerKey?.length) return 5;
  const hasE = answerKey.some((a) => /^E$/i.test((a ?? '').trim()));
  return hasE ? 5 : 4;
}
