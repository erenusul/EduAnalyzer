import type { ExamResult, WrongQuestion } from '../types/teacher';

/** Konu karşılaştırması için normalize anahtar (TR küçük harf). */
export function normTopicKey(topic: string | undefined): string {
  return (topic?.trim() || 'Bilinmiyor').toLowerCase();
}

/**
 * `sortedNewestFirst[0]` en yeni sınavdır. `current` sonucun hemen bir önceki sınavını döndürür.
 */
export function getPreviousExamResult(
  sortedNewestFirst: ExamResult[],
  current: ExamResult
): ExamResult | null {
  const i = sortedNewestFirst.findIndex((r) => r.id === current.id);
  if (i < 0 || i + 1 >= sortedNewestFirst.length) return null;
  return sortedNewestFirst[i + 1];
}

/** Sınavda en az bir yanlış kaydı olan konu anahtarları. */
export function topicWrongKeySetFromResult(r: ExamResult): Set<string> {
  const set = new Set<string>();
  const wq = r.wrongQuestions ?? [];
  if (wq.length > 0) {
    for (const w of wq) set.add(normTopicKey(w.topic));
    return set;
  }
  for (const wt of r.wrongTopics ?? []) {
    const c = typeof wt.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
    if (c > 0) set.add(normTopicKey(wt.topic));
  }
  return set;
}

/** Bu sınava ait soru satırlarında geçen konular (doğru + yanlış). */
export function topicsTouchedInResult(r: ExamResult): Set<string> {
  const s = topicWrongKeySetFromResult(r);
  for (const q of r.correctQuestions ?? []) s.add(normTopicKey(q.topic));
  return s;
}

export interface TopicImprovementItem {
  topicKey: string;
  displayName: string;
}

function pickDisplayTopicName(key: string, current: ExamResult, previous: ExamResult): string {
  for (const q of current.correctQuestions ?? []) {
    if (normTopicKey(q.topic) === key) return q.topic.trim() || key;
  }
  for (const w of previous.wrongQuestions ?? []) {
    if (normTopicKey(w.topic) === key) return w.topic.trim() || key;
  }
  for (const wt of previous.wrongTopics ?? []) {
    if (normTopicKey(wt.topic) === key) return (wt.topic ?? '').trim() || key;
  }
  return key;
}

/**
 * Bir önceki sınavda yanlış yapılan, bu sınavda yanlış kaydı olmayan ve bu sınavda yer alan konular (gelişim).
 */
export function listTopicImprovementsSincePrevious(
  current: ExamResult,
  previous: ExamResult | null
): TopicImprovementItem[] {
  if (!previous) return [];
  const prevWrong = topicWrongKeySetFromResult(previous);
  const currWrong = topicWrongKeySetFromResult(current);
  const touched = topicsTouchedInResult(current);
  const out: TopicImprovementItem[] = [];
  for (const key of prevWrong) {
    if (currWrong.has(key)) continue;
    if (!touched.has(key)) continue;
    out.push({ topicKey: key, displayName: pickDisplayTopicName(key, current, previous) });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
}

/** Bu yanlış sorunun konusu bir önceki sınavda da yanlış mıydı? */
export function isSameTopicWrongAgain(question: WrongQuestion, previous: ExamResult | null): boolean {
  if (!previous) return false;
  return topicWrongKeySetFromResult(previous).has(normTopicKey(question.topic));
}
