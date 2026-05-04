/**
 * Sınav sorusu (1-based indeks) → konu etiketi: PDF analizi ve sınavda seçilen soru alt kümesi ile hizalı.
 * Backend ExamService.GradeStudentAnswersCore ile aynı seçim kuralı (önce selectedResults, yoksa tam analiz).
 */

import type { AnalysisRecord, Exam } from '../types/teacher';
import type { QuestionAnalysisResult } from '../types/prediction';

const FALLBACK_TOPICS = [
  'Sözcükte Anlam',
  'Cümlede Anlam',
  'Paragraf',
  'Dil Bilgisi',
  'Yazım ve Noktalama',
  'Şiir / Edebiyat',
  'Yazım Kuralları',
] as const;

export function fallbackTopicForQuestionNumber(questionNumber1Based: number): string {
  const idx = Math.max(0, questionNumber1Based - 1) % FALLBACK_TOPICS.length;
  return FALLBACK_TOPICS[idx]!;
}

function firstNonEmptyLabel(items: { label?: string }[] | undefined): string {
  for (const x of items ?? []) {
    const l = typeof x?.label === 'string' ? x.label.trim() : '';
    if (l) return l;
  }
  return '';
}

export function topicLabelFromAnalysisRow(
  row: QuestionAnalysisResult | null | undefined,
  questionNumber1Based: number
): string {
  if (!row) return fallbackTopicForQuestionNumber(questionNumber1Based);
  const t = firstNonEmptyLabel(row.topic);
  if (t) return t;
  const s = firstNonEmptyLabel(row.subject);
  if (s) return s;
  return fallbackTopicForQuestionNumber(questionNumber1Based);
}

function parsePdfResultsFromAnalysis(analysis: AnalysisRecord | undefined): QuestionAnalysisResult[] {
  if (!analysis?.results || typeof analysis.results !== 'object') return [];
  const r = analysis.results as { results?: unknown };
  const arr = r.results;
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean) as QuestionAnalysisResult[];
}

function parseSelectedQuestionRows(exam: Exam | undefined): QuestionAnalysisResult[] | null {
  const sr = exam?.selectedResults;
  if (!Array.isArray(sr) || sr.length === 0) return null;
  return sr.filter(Boolean) as QuestionAnalysisResult[];
}

/**
 * Soru numarası (1…N) → konu adı.
 */
export function buildExamQuestionTopicMap(
  analysis: AnalysisRecord | undefined,
  exam: Exam | undefined
): Map<number, string> {
  const full = parsePdfResultsFromAnalysis(analysis);
  const selected = parseSelectedQuestionRows(exam);
  const keyLen = exam?.answerKey?.length ?? 0;
  const maxSlots = Math.max(full.length, selected?.length ?? 0, keyLen, 1);
  const map = new Map<number, string>();
  for (let i = 0; i < maxSlots; i++) {
    const row =
      selected != null && i < selected.length
        ? selected[i] ?? null
        : full.length > 0 && i < full.length
          ? full[i] ?? null
          : null;
    map.set(i + 1, topicLabelFromAnalysisRow(row, i + 1));
  }
  return map;
}

export function resolveWrongQuestionTopicLabel(
  questionIndex: number,
  storedTopic: string | undefined,
  examTopicByQuestion: Map<number, string>
): string {
  const stored = typeof storedTopic === 'string' ? storedTopic.trim() : '';
  const fromExam = (examTopicByQuestion.get(questionIndex) ?? '').trim();
  const storedWeak =
    !stored ||
    stored === 'Bilinmiyor' ||
    stored === 'Konu atanmamış';
  if (!storedWeak) return stored;
  if (fromExam) return fromExam;
  if (stored) return stored;
  return 'Bilinmiyor';
}
