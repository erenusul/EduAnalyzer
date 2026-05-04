import { apiPatch, apiUploadFormData } from './apiClient';
import type { ScanExamResponse } from '../../types/exam';
import { OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP as TURKISH_COLUMN_CROP_TEMPLATE_ID } from '../../constants/opticalTurkishColumn';

/** 212×300 mm A4, yalnızca Türkçe 20×4 mm şablonu (ML tarafıyla aynı kimlik). */
export const OPTICAL_TEMPLATE_LGS_TURKISH_212X300 = 'lgs_turkish_212x300';

/**
 * OMRChecker (sunucuda OMR_CHECKER_TEMPLATE_JSON + requirements-omrchecker).
 * Yapılandırma yoksa ML otomatik olarak dahili 212×300 okuyucuya düşer.
 */
export const OPTICAL_TEMPLATE_LGS_TURKISH_OMRCHECKER = 'lgs_turkish_omrchecker';

/** 117×107 mm SÖZEL kırpıntısı: 4 sütun × 20 satır (ML ile aynı kimlik). Kadraj bu alanı doldurmalı. */
export const OPTICAL_TEMPLATE_LGS_SOZEL_CROP_117X107 = 'lgs_sozel_crop_117x107';

/** Türkçe sütun şablon kimliği (ML `lgs_turkish_column_crop`); Metro için açık const re-export. */
export const OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP = TURKISH_COLUMN_CROP_TEMPLATE_ID;

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

/**
 * ML optik geometrisi: Türkçe sütun şablonunda basılı kağıt A–E olduğu için her zaman 5 şık gönderilir;
 * cevap anahtarı yalnız A–D olsa bile (8. sınıf Türkçe). Diğer şablonlarda anahtardan türetilir.
 */
export function getOpticalSubmitOptionCount(
  opticalTemplate: string | undefined,
  answerKey?: string[] | null
): number {
  if (opticalTemplate === TURKISH_COLUMN_CROP_TEMPLATE_ID) {
    return 5;
  }
  return getOptionCountFromAnswerKey(answerKey);
}

/** Cevap anahtarındaki maksimum şık sayısına göre A… harfleri (A–D veya A–E). */
export function getOptionLetterChoicesFromAnswerKey(answerKey?: string[] | null): string[] {
  const n = getOptionCountFromAnswerKey(answerKey);
  return 'ABCDE'.slice(0, n).split('');
}

export interface OpticalReadingCorrection {
  questionIndex: number;
  /** Boş: öğrenci bilinçli olarak boş bırakıyor. */
  answer: string;
}

/**
 * Sadece sunucudaki "Belirsiz veya boş okuma" maddeleri için; PATCH gövdesi tüm o maddeleri içermelidir.
 */
export function applyOpticalReadingCorrections(
  examResultId: string,
  corrections: OpticalReadingCorrection[]
): Promise<ScanExamResponse> {
  return apiPatch<ScanExamResponse>(`/api/me/results/${examResultId}/optical-corrections`, {
    corrections: corrections.map((c) => ({ questionIndex: c.questionIndex, answer: c.answer })),
  });
}
