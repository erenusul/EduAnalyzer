/**
 * Öğrenci performans özetleri — viewer-app parentResultUtils ile aynı mantık (TEK KAYNAK davranışı).
 */
import type { ExamResult, WrongTopic } from '../types/exam';

export function sortResultsByDateDesc(results: ExamResult[]): ExamResult[] {
  return [...results].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function chronologicalResults(results: ExamResult[]): ExamResult[] {
  return [...results].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function successPct(result: ExamResult): number {
  const total = result.correctCount + result.wrongCount;
  if (total <= 0) return 0;
  return Math.round((result.correctCount / total) * 1000) / 10;
}

export function lgsNet(result: ExamResult): number {
  return Math.round((result.correctCount - result.wrongCount / 4) * 10) / 10;
}

export function parentExamAxisLabel(r: ExamResult): string {
  const d = new Date(r.createdAt).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
  });
  const t = r.examTitle?.trim();
  if (t) {
    const short = t.length > 22 ? `${t.slice(0, 22)}…` : t;
    return `${short} (${d})`;
  }
  return d;
}

export type ParentChartRow = {
  eksen: string;
  net: number;
  basari: number;
};

export function buildParentChartRows(results: ExamResult[]): ParentChartRow[] {
  return chronologicalResults(results).map((r) => ({
    eksen: parentExamAxisLabel(r),
    net: lgsNet(r),
    basari: successPct(r),
  }));
}

export function wrongTopicBreakdownForExamResult(result: ExamResult): WrongTopic[] {
  const wq = result.wrongQuestions ?? [];
  if (wq.length > 0) {
    const map = new Map<string, number>();
    for (const q of wq) {
      const t = q.topic?.trim() ? q.topic.trim() : 'Bilinmiyor';
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'tr'));
  }
  return (result.wrongTopics ?? [])
    .map((wt) => ({
      topic: wt.topic?.trim() ? wt.topic.trim() : 'Bilinmiyor',
      count: typeof wt.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0,
    }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'tr'));
}

export function aggregateWrongTopicsFromResults(results: ExamResult[]): WrongTopic[] {
  const map = new Map<string, number>();
  for (const r of results) {
    for (const row of wrongTopicBreakdownForExamResult(r)) {
      map.set(row.topic, (map.get(row.topic) ?? 0) + row.count);
    }
  }
  return Array.from(map.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'tr'));
}

export function repeatedWeakTopicNamesFromResults(results: ExamResult[], lastN: number): string[] {
  const slice = sortResultsByDateDesc(results).slice(0, Math.max(1, lastN));
  const freq = new Map<string, number>();
  for (const r of slice) {
    const seen = new Set<string>();
    for (const row of wrongTopicBreakdownForExamResult(r)) {
      if (row.count <= 0) continue;
      const name = row.topic;
      if (seen.has(name)) continue;
      seen.add(name);
      freq.set(name, (freq.get(name) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([t]) => t);
}

export function sortedQuestions(list: ExamResult['wrongQuestions']) {
  if (!list?.length) return [];
  return [...list].sort((a, b) => a.questionIndex - b.questionIndex);
}
