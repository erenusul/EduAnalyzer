/**
 * Veli paneli — özet raporlar (KPI + kısa içgörüler, öğretmen raporları kadar ağır değil)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { meApi, mappers } from '../services/backendApi';
import type { StudentWithResults } from '../services/backendApi';
import {
  aggregateWrongTopics,
  buildParentInsights,
  lgsNet,
  sortResultsByDateDesc,
  successPct,
} from '../utils/parentResultUtils';

export function ParentReportsScreen() {
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

  const blocks = useMemo(() => {
    return children.map((c) => {
      const results = sortResultsByDateDesc(c.results.map(mappers.toExamResult));
      const latest = results[0];
      const agg = aggregateWrongTopics(results);
      const weakest = agg[0] ?? null;
      const avg =
        results.length > 0
          ? Math.round((results.reduce((s, r) => s + successPct(r), 0) / results.length) * 10) / 10
          : 0;
      const insights = buildParentInsights(results);
      return {
        student: c.student,
        results,
        latest,
        avg,
        weakest,
        insights,
      };
    });
  }, [children]);

  const totalExams = useMemo(() => blocks.reduce((s, b) => s + b.results.length, 0), [blocks]);

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
        <h3 className="fw-bold text-dark mb-2">Özet raporlar</h3>
        <p className="text-muted mb-0">
          Çocuklarınızın sınav özetleri ve kısa gelişim notları. Detay için çocuk kartına gidebilirsiniz.
        </p>
      </div>

      {children.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-people fs-1 d-block mb-3 opacity-50" />
            Henüz bağlı öğrenciniz bulunmuyor.
          </Card.Body>
        </Card>
      ) : totalExams === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <i className="bi bi-journal-x fs-1 text-muted d-block mb-3" />
            <h5 className="fw-semibold text-dark">Henüz sınav verisi bulunmuyor</h5>
            <p className="text-muted mb-0 small">Raporlar sınav sonuçları geldikçe burada oluşacak.</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body className="py-4">
              <Row className="g-3 text-center text-md-start">
                <Col xs={6} md={3}>
                  <div className="text-muted small">Bağlı çocuk</div>
                  <div className="fs-3 fw-bold text-dark">{children.length}</div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="text-muted small">Toplam sınav kaydı</div>
                  <div className="fs-3 fw-bold text-primary">{totalExams}</div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="text-muted small">Not</div>
                  <p className="mb-0 small text-muted">
                    Aşağıdaki kartlar her çocuk için ayrı özet gösterir. Gelişim grafiği için{' '}
                    <Link to="/parent/analysis">Gelişim analizi</Link> sayfasını kullanın.
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <div className="d-flex flex-column gap-4">
            {blocks.map(({ student, results, latest, avg, weakest, insights }) => (
              <Card key={student.id} className="border-0 shadow-sm">
                <Card.Header className="bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div>
                    <h5 className="fw-bold mb-0">
                      {student.firstName} {student.lastName}
                    </h5>
                    <span className="text-muted small">{results.length} sınav</span>
                  </div>
                  <Link to={`/parent/student/${student.id}`} className="btn btn-sm btn-light-primary border">
                    Detaylı görünüm
                  </Link>
                </Card.Header>
                <Card.Body className="p-4">
                  {results.length === 0 ? (
                    <p className="text-muted small mb-0">Bu çocuk için henüz sınav sonucu yok.</p>
                  ) : (
                    <>
                      <Row className="g-3 mb-4">
                        <Col sm={6} xl={3}>
                          <div className="rounded-3 border bg-light p-3 h-100">
                            <div className="text-muted small mb-1">Ortalama başarı</div>
                            <div className="fs-4 fw-bold text-primary">%{avg}</div>
                          </div>
                        </Col>
                        <Col sm={6} xl={3}>
                          <div className="rounded-3 border bg-light p-3 h-100">
                            <div className="text-muted small mb-1">Son sınav net</div>
                            <div className="fs-4 fw-bold text-info">{latest ? lgsNet(latest) : '—'}</div>
                          </div>
                        </Col>
                        <Col sm={6} xl={3}>
                          <div className="rounded-3 border bg-light p-3 h-100">
                            <div className="text-muted small mb-1">Son başarı</div>
                            <div className="fs-4 fw-bold text-success">
                              {latest ? `${successPct(latest)}%` : '—'}
                            </div>
                          </div>
                        </Col>
                        <Col sm={6} xl={3}>
                          <div className="rounded-3 border bg-light p-3 h-100">
                            <div className="text-muted small mb-1">En zayıf konu (tüm sınavlar)</div>
                            <div className="fw-semibold text-dark small">
                              {weakest ? (
                                <>
                                  {weakest.topic}{' '}
                                  <Badge bg="light-danger" text="danger" className="fw-normal ms-1">
                                    {weakest.count} yanlış
                                  </Badge>
                                </>
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>
                        </Col>
                      </Row>

                      {latest && (
                        <div className="rounded-3 border p-3 mb-3 bg-white">
                          <div className="small text-muted fw-semibold text-uppercase mb-2">Son sınav özeti</div>
                          <div className="fw-medium">{latest.examTitle?.trim() || 'Sınav'}</div>
                          <div className="text-muted small mb-2">
                            {new Date(latest.createdAt).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="small">
                            <span className="text-success fw-semibold">{latest.correctCount}</span>
                            <span className="text-muted mx-1">doğru</span>
                            <span className="text-danger fw-semibold">{latest.wrongCount}</span>
                            <span className="text-muted ms-1">yanlış</span>
                            <span className="text-muted ms-2">Net: </span>
                            <span className="fw-bold text-primary">{lgsNet(latest)}</span>
                          </div>
                        </div>
                      )}

                      <div className="small text-muted fw-semibold text-uppercase mb-2">Kısa notlar</div>
                      <ul className="mb-0 ps-3 small">
                        {insights.netDelta && <li className="mb-1">{insights.netDelta}</li>}
                        <li className="mb-1">{insights.trend}</li>
                        {insights.hardestTopic && <li className="mb-1">{insights.hardestTopic}</li>}
                        {insights.repeatedWeak && <li className="mb-0">{insights.repeatedWeak}</li>}
                        {!insights.netDelta && !insights.hardestTopic && !insights.repeatedWeak && (
                          <li className="text-muted mb-0">Daha fazla sınavla detaylı içgörüler oluşur.</li>
                        )}
                      </ul>
                    </>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </>
      )}
    </Container>
  );
}
