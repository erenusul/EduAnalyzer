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
import type { ExamResult } from '../types/teacher';

export function StudentDashboard() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    meApi
      .getMyResults()
      .then((data) => {
        if (!cancelled) {
          setResults(data.map(mappers.toExamResult));
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

  const weeklyChartData = useMemo(() => {
    return [...results]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((r) => ({
        week: new Date(r.createdAt).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
        }),
        dogru: r.correctCount,
        yanlis: r.wrongCount,
      }));
  }, [results]);

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
                  Haftalık Gelişim
                </h6>
              </Card.Header>
              <Card.Body>
                <div
                  className="w-100"
                  style={{ minWidth: 0 }}
                  role="img"
                  aria-label="Haftalık sınav sonuçları grafiği"
                >
                  <ResponsiveContainer width="100%" height={220} debounce={32}>
                    <LineChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="dogru"
                        stroke="var(--bs-success)"
                        name="Doğru"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="yanlis"
                        stroke="var(--bs-danger)"
                        name="Yanlış"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          )}
          <div className="d-flex flex-column gap-3">
            {results.map((r) => (
              <Card key={r.id} className="border-0 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div>
                      <span className="badge bg-secondary me-2">
                        {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="fw-semibold">
                        Doğru: {r.correctCount} / Yanlış: {r.wrongCount}
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
