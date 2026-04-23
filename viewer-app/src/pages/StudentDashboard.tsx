/**
 * Öğrenci paneli - Kendi sınav sonuçlarım
 */

import { useEffect, useState, useMemo } from 'react';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { meApi, mappers } from '../services/backendApi';
import type { BackendExam } from '../services/backendApi';
import type { ExamResult } from '../types/teacher';
import {
  calendarWeekSortKeyMs,
  formatCalendarWeekRangeLabel,
  parseUtcToLocal,
  startOfCalendarWeekMondayLocal,
} from '../utils/dateUtils';

interface WeeklyAggRow {
  weekLabel: string;
  dogru: number;
  yanlis: number;
  net: number;
  basariPct: number;
  sortKey: number;
}

function aggregateWeekly(
  results: ExamResult[],
  examsById: Map<string, BackendExam>
): WeeklyAggRow[] {
  type Bucket = {
    dogru: number;
    yanlis: number;
    sortKey: number;
    /** grafik ekseni için kısa etiket */
    axisLabel: string;
  };

  const buckets = new Map<string, Bucket>();

  for (const r of results) {
    const exam = examsById.get(r.examId);
    const wlRaw = exam?.weekLabel?.trim();

    let key: string;
    let sortKey: number;
    let axisLabel: string;

    if (wlRaw) {
      key = `wl:${wlRaw}`;
      axisLabel = wlRaw;
      const examDateMs = exam?.date ? parseUtcToLocal(`${exam.date.split('T')[0]}T12:00:00Z`).getTime() : calendarWeekSortKeyMs(r.createdAt);
      sortKey = examDateMs;
    } else {
      const d = parseUtcToLocal(r.createdAt);
      const monday = startOfCalendarWeekMondayLocal(d);
      sortKey = monday.getTime();
      key = `cal:${sortKey}`;
      axisLabel = formatCalendarWeekRangeLabel(monday);
    }

    const prev = buckets.get(key);
    const dogru = r.correctCount;
    const yanlis = r.wrongCount;

    if (!prev) {
      buckets.set(key, {
        dogru,
        yanlis,
        sortKey,
        axisLabel,
      });
    } else {
      prev.dogru += dogru;
      prev.yanlis += yanlis;
      prev.sortKey = Math.min(prev.sortKey, sortKey);
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((b) => {
      const total = b.dogru + b.yanlis;
      const net = b.dogru - b.yanlis / 4;
      const basariPct = total > 0 ? Math.round((b.dogru / total) * 1000) / 10 : 0;
      return {
        weekLabel: b.axisLabel,
        dogru: b.dogru,
        yanlis: b.yanlis,
        net: Math.round(net * 10) / 10,
        basariPct,
        sortKey: b.sortKey,
      };
    });
}

export function StudentDashboard() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [examsById, setExamsById] = useState<Map<string, BackendExam>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([meApi.getMyResults(), meApi.getMyExams()])
      .then(([rawResults, rawExams]) => {
        if (!cancelled) {
          setResults(rawResults.map(mappers.toExamResult));
          const m = new Map<string, BackendExam>();
          for (const e of rawExams) {
            m.set(e.id, e);
          }
          setExamsById(m);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Sonuçlar yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const weeklyChartData = useMemo(() => aggregateWeekly(results, examsById), [results, examsById]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" dismissible onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  return (
    <div>
      <h4 className="mb-4">Sınav Sonuçlarım</h4>
      {results.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center text-muted py-5">
            <i className="bi bi-clipboard2-data display-4 d-block mb-2" />
            Henüz sınav sonucunuz bulunmuyor.
          </Card.Body>
        </Card>
      ) : (
        <>
          {weeklyChartData.length > 0 && (
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white border-bottom py-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-graph-up me-2" />
                  Haftalık gelişim
                </h6>
                <p className="text-muted small mb-0 mt-1">
                  Aynı sınav haftası etiketi veya takvim haftası (Pazartesi başlangıç) bazında toplanır;
                  bir haftada birden fazla sınav varsa doğru ve yanlışlar toplanır.
                </p>
              </Card.Header>
              <Card.Body>
                <div
                  className="w-100"
                  style={{ minWidth: 0 }}
                  role="img"
                  aria-label="Haftalık sınav sonuçları grafiği"
                >
                  <ResponsiveContainer width="100%" height={260} debounce={32}>
                    <LineChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="weekLabel" interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                      <Tooltip
                        formatter={(value: number | undefined, name: string | undefined) => {
                          if (name === 'basariPct') return [`${value ?? 0}%`, 'Başarı'];
                          if (name === 'net') return [value ?? 0, 'Net (Türkçe/LGS)'];
                          return [value ?? 0, name ?? ''];
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="dogru"
                        stroke="var(--bs-success)"
                        name="Doğru"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="yanlis"
                        stroke="var(--bs-danger)"
                        name="Yanlış"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="net"
                        stroke="var(--bs-info)"
                        name="Net (Türkçe/LGS)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="basariPct"
                        stroke="var(--bs-warning)"
                        name="Başarı %"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          )}
          <div className="d-flex flex-column gap-3">
            {results.map((r) => {
              const examMeta = examsById.get(r.examId);
              const title = r.examTitle ?? examMeta?.title ?? 'Sınav';
              return (
                <Card key={r.id} className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                      <div>
                        <span className="badge bg-secondary me-2">
                          {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                        <span className="fw-semibold d-block mt-1">{title}</span>
                        <span className="text-muted small">
                          Doğru: {r.correctCount} / Yanlış: {r.wrongCount}
                          {examMeta?.weekLabel ? (
                            <span className="ms-2">· {examMeta.weekLabel}</span>
                          ) : null}
                        </span>
                      </div>
                      <Link
                        to={`/student/sonuc/${r.id}`}
                        className="btn btn-sm btn-outline-primary"
                        aria-label="Sonuç detayını görüntüle"
                      >
                        Detay
                      </Link>
                    </div>
                    {r.wrongTopics && r.wrongTopics.length > 0 && (
                      <div className="mt-2">
                        <small className="text-muted">Zayıf konular: </small>
                        {r.wrongTopics.map((t, i) => (
                          <span key={i} className="badge bg-warning text-dark me-1">
                            {t.topic} ({t.count})
                          </span>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
