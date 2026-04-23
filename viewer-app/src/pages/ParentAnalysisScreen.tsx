/**
 * Veli paneli — tüm çocuklar için gelişim özeti (grafik + konu analizi)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { meApi, mappers } from '../services/backendApi';
import type { StudentWithResults } from '../services/backendApi';
import type { ExamResult } from '../types/teacher';
import {
  aggregateWrongTopics,
  buildParentChartRows,
  repeatedWeakTopicNames,
  sortResultsByDateDesc,
} from '../utils/parentResultUtils';

export function ParentAnalysisScreen() {
  const [children, setChildren] = useState<StudentWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    meApi
      .getMyChildren()
      .then((data) => {
        if (!cancelled) setChildren(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Veriler yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const childrenWithMappedResults = useMemo(
    () =>
      children.map((c) => ({
        student: c.student,
        results: sortResultsByDateDesc(c.results.map(mappers.toExamResult)),
      })),
    [children]
  );

  const totalExamCount = useMemo(
    () => childrenWithMappedResults.reduce((sum, c) => sum + c.results.length, 0),
    [childrenWithMappedResults]
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="border-0 shadow-sm">
        {error}
      </Alert>
    );
  }

  return (
    <Container fluid className="px-0">
      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-2">Gelişim analizi</h3>
        <p className="text-muted mb-0">
          Bağlı çocuklarınızın sınav performansı, net ve başarı eğrisi ile konu bazlı özet.
        </p>
      </div>

      {children.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-people fs-1 d-block mb-3 opacity-50" />
            Henüz bağlı öğrenciniz bulunmuyor.
          </Card.Body>
        </Card>
      ) : totalExamCount === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <i className="bi bi-journal-x fs-1 text-muted d-block mb-3" />
            <h5 className="fw-semibold text-dark">Henüz sınav verisi bulunmuyor</h5>
            <p className="text-muted mb-0 small">
              Sınav sonuçları yüklendiğinde grafik ve konu analizleri burada görünecek.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <div className="d-flex flex-column gap-4">
          {childrenWithMappedResults.map(({ student, results }) => (
            <ChildAnalysisBlock key={student.id} studentId={student.id} studentName={`${student.firstName} ${student.lastName}`} results={results} />
          ))}
        </div>
      )}
    </Container>
  );
}

function ChildAnalysisBlock({
  studentId,
  studentName,
  results,
}: {
  studentId: string;
  studentName: string;
  results: ExamResult[];
}) {
  const chartRows = useMemo(() => buildParentChartRows(results), [results]);
  const topics = useMemo(() => aggregateWrongTopics(results).slice(0, 8), [results]);
  const repeatedWeak = useMemo(() => repeatedWeakTopicNames(results, 3), [results]);
  const maxTopicCount = topics[0]?.count ?? 1;

  if (results.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-4">
          <div>
            <h5 className="fw-bold mb-0">{studentName}</h5>
            <span className="text-muted small">Henüz sınav sonucu yok</span>
          </div>
          <Link to={`/parent/student/${studentId}`} className="btn btn-sm btn-outline-primary">
            Detay
          </Link>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h5 className="fw-bold mb-0">{studentName}</h5>
          <span className="text-muted small">{results.length} sınav kaydı</span>
        </div>
        <Link to={`/parent/student/${studentId}`} className="btn btn-sm btn-light-primary border">
          Çocuk detayı
        </Link>
      </Card.Header>
      <Card.Body className="p-4">
        {results.length === 1 && (
          <Alert variant="light" className="border small py-2 mb-4">
            <i className="bi bi-info-circle me-2 text-primary" />
            Daha fazla sınav ile daha doğru analiz yapılacaktır.
          </Alert>
        )}

        <Row className="g-4">
          <Col lg={7}>
            <div className="small text-muted fw-semibold text-uppercase mb-2">Net ve başarı yüzdesi</div>
            <div style={{ height: 260, width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={32}>
                <LineChart data={chartRows} margin={{ top: 12, left: 0, right: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E6EF" />
                  <XAxis
                    dataKey="eksen"
                    tick={{ fontSize: 10, fill: '#A1A5B7' }}
                    tickMargin={8}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#A1A5B7' }} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#A1A5B7' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.08)' }} />
                  <Legend wrapperStyle={{ paddingTop: 12 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="net"
                    name="Net"
                    stroke="var(--bs-info)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="basari"
                    name="Başarı %"
                    stroke="var(--bs-success)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Col>
          <Col lg={5}>
            <div className="small text-muted fw-semibold text-uppercase mb-2">En çok yanlış yapılan konular</div>
            {topics.length > 0 ? (
              <div className="d-flex flex-column gap-3">
                {topics.map((t) => {
                  const pct = Math.min(100, Math.round((t.count / maxTopicCount) * 100));
                  return (
                    <div key={t.topic}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small fw-medium text-dark">{t.topic}</span>
                        <Badge bg="light-danger" text="danger" className="fw-normal">
                          {t.count}
                        </Badge>
                      </div>
                      <div className="progress" style={{ height: 6 }}>
                        <div className="progress-bar bg-danger" style={{ width: `${pct}%` }} role="progressbar" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted small mb-0">Bu çocuk için konu bazlı yanlış özeti yok.</p>
            )}
            {repeatedWeak.length > 0 && (
              <div className="mt-4 pt-3 border-top">
                <div className="small text-muted fw-semibold text-uppercase mb-2">Son sınavlarda tekrar eden zayıf konular</div>
                <div className="d-flex flex-wrap gap-2">
                  {repeatedWeak.map((name) => (
                    <Badge key={name} bg="warning" text="dark" className="fw-normal">
                      {name}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted small mb-0 mt-2">
                  Bu konular birden fazla sınavda yanlış olarak görüldü.
                </p>
              </div>
            )}
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
