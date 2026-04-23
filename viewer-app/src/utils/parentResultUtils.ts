import type { ExamResult, WrongQuestion, WrongTopic } from '../types/teacher';

export function sortResultsByDateDesc(results: ExamResult[]): ExamResult[] {
  return [...results].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Grafikler için eski → yeni sıra */
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

/** Eksen etiketi: mümkünse sınav adı, yoksa kısa tarih */
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
  dogru: number;
  yanlis: number;
  net: number;
  basari: number;
};

export function buildParentChartRows(results: ExamResult[]): ParentChartRow[] {
  return chronologicalResults(results).map((r) => ({
    eksen: parentExamAxisLabel(r),
    dogru: r.correctCount,
    yanlis: r.wrongCount,
    net: lgsNet(r),
    basari: successPct(r),
  }));
}

export function aggregateWrongTopics(results: ExamResult[]): WrongTopic[] {
  const map = new Map<string, number>();
  for (const r of results) {
    for (const wt of r.wrongTopics ?? []) {
      const topic = wt.topic?.trim() ? wt.topic.trim() : 'Bilinmiyor';
      map.set(topic, (map.get(topic) ?? 0) + (wt.count ?? 0));
    }
  }
  return Array.from(map.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

/** Son sınavın wrongTopics listesi (sınav içi sayıya göre) */
export function weakTopicsFromLatestExam(results: ExamResult[]): WrongTopic[] {
  const latest = sortResultsByDateDesc(results)[0];
  if (!latest?.wrongTopics?.length) return [];
  return [...latest.wrongTopics]
    .map((wt) => ({
      topic: wt.topic?.trim() ? wt.topic.trim() : 'Bilinmiyor',
      count: typeof wt.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0,
    }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'tr'));
}

/**
 * Son N sınavda, birden fazla sınavın wrongTopics içinde geçen konu adları.
 */
export function repeatedWeakTopicNames(results: ExamResult[], lastN: number): string[] {
  const slice = sortResultsByDateDesc(results).slice(0, Math.max(1, lastN));
  const freq = new Map<string, number>();
  for (const r of slice) {
    const seen = new Set<string>();
    for (const wt of r.wrongTopics ?? []) {
      const c = typeof wt.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
      if (c <= 0) continue;
      const name = wt.topic?.trim() ? wt.topic.trim() : 'Bilinmiyor';
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

export type ParentInsights = {
  netDelta: string | null;
  hardestTopic: string | null;
  repeatedWeak: string | null;
  trend: string;
};

const trendThreshold = 2;

function trendFromResults(sortedDesc: ExamResult[]): 'up' | 'down' | 'stable' {
  if (sortedDesc.length < 2) return 'stable';
  if (sortedDesc.length >= 4) {
    const recent =
      (successPct(sortedDesc[0]) + successPct(sortedDesc[1])) / 2;
    const older =
      (successPct(sortedDesc[2]) + successPct(sortedDesc[3])) / 2;
    if (recent - older > trendThreshold) return 'up';
    if (recent - older < -trendThreshold) return 'down';
    return 'stable';
  }
  const a = successPct(sortedDesc[0]);
  const b = successPct(sortedDesc[1]);
  if (a - b > trendThreshold) return 'up';
  if (a - b < -trendThreshold) return 'down';
  return 'stable';
}

/** Kural tabanlı veli içgörü metinleri (LLM yok) */
export function buildParentInsights(results: ExamResult[]): ParentInsights {
  const sorted = sortResultsByDateDesc(results);
  if (sorted.length === 0) {
    return {
      netDelta: null,
      hardestTopic: null,
      repeatedWeak: null,
      trend: 'Henüz karşılaştırma için yeterli sınav yok.',
    };
  }

  let netDelta: string | null = null;
  if (sorted.length >= 2) {
    const d = Math.round((lgsNet(sorted[0]) - lgsNet(sorted[1])) * 10) / 10;
    const sign = d > 0 ? '+' : '';
    netDelta = `Son sınav bir öncekine göre ${sign}${d} net.`;
  }

  const agg = aggregateWrongTopics(sorted);
  let hardestTopic: string | null = null;
  if (agg.length > 0 && agg[0].count > 0) {
    hardestTopic = `En çok zorlandığı konu: ${agg[0].topic} (toplam ${agg[0].count} yanlış).`;
  }

  const repeated = repeatedWeakTopicNames(sorted, 3);
  let repeatedWeak: string | null = null;
  if (repeated.length > 0) {
    const list = repeated.slice(0, 3).join(', ');
    repeatedWeak = `Son 3 sınavda tekrar eden zayıf konu${repeated.length > 1 ? 'lar' : ''}: ${list}.`;
  }

  const tr = trendFromResults(sorted);
  const trend =
    tr === 'up'
      ? 'Başarı trendi: son sınavlara göre yükseliyor.'
      : tr === 'down'
        ? 'Başarı trendi: son sınavlara göre düşüyor.'
        : 'Başarı trendi: son sınavlara göre kabaca sabit.';

  return { netDelta, hardestTopic, repeatedWeak, trend };
}

export function sortedQuestions(list: WrongQuestion[] | undefined) {
  if (!list?.length) return [];
  return [...list].sort((a, b) => a.questionIndex - b.questionIndex);
}
