import { describe, it, expect } from 'vitest';
import {
  buildParentInsights,
  buildParentChartRows,
  repeatedWeakTopicNames,
  lgsNet,
} from './parentResultUtils';
import type { ExamResult } from '../types/teacher';

function r(partial: Partial<ExamResult> & Pick<ExamResult, 'id' | 'createdAt'>): ExamResult {
  return {
    studentId: 's',
    examId: 'e',
    correctCount: 0,
    wrongCount: 0,
    wrongTopics: [],
    ...partial,
  };
}

describe('buildParentInsights', () => {
  it('returns empty-state trend when no results', () => {
    const i = buildParentInsights([]);
    expect(i.trend).toMatch(/yeterli sınav yok/i);
    expect(i.netDelta).toBeNull();
  });

  it('computes net delta between last two exams', () => {
    const results = [
      r({
        id: '1',
        createdAt: '2025-02-01T10:00:00Z',
        correctCount: 10,
        wrongCount: 0,
      }),
      r({
        id: '2',
        createdAt: '2025-01-01T10:00:00Z',
        correctCount: 8,
        wrongCount: 2,
      }),
    ];
    const i = buildParentInsights(results);
    expect(i.netDelta).toMatch(/son sınav/i);
    expect(i.netDelta).toMatch(/net/i);
    const latestNet = lgsNet(results[0]);
    const prevNet = lgsNet(results[1]);
    expect(latestNet - prevNet).toBeGreaterThan(0);
  });
});

describe('repeatedWeakTopicNames', () => {
  it('finds topics in wrongTopics across last N exams', () => {
    const results = [
      r({
        id: '1',
        createdAt: '2025-03-01T10:00:00Z',
        wrongTopics: [{ topic: 'Cebir', count: 1 }],
      }),
      r({
        id: '2',
        createdAt: '2025-02-01T10:00:00Z',
        wrongTopics: [{ topic: 'Cebir', count: 2 }],
      }),
      r({
        id: '3',
        createdAt: '2025-01-01T10:00:00Z',
        wrongTopics: [{ topic: 'Geometri', count: 1 }],
      }),
    ];
    expect(repeatedWeakTopicNames(results, 3)).toContain('Cebir');
  });
});

describe('buildParentChartRows', () => {
  it('orders chronologically for chart', () => {
    const results = [
      r({ id: '2', createdAt: '2025-02-01T10:00:00Z', correctCount: 5, wrongCount: 5 }),
      r({ id: '1', createdAt: '2025-01-01T10:00:00Z', correctCount: 8, wrongCount: 2 }),
    ];
    const rows = buildParentChartRows(results);
    expect(rows[0].dogru).toBe(8);
    expect(rows[1].dogru).toBe(5);
  });
});
