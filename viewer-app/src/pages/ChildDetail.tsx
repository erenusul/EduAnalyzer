import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Card, Spinner, Table, Row, Col, Badge, Container } from 'react-bootstrap';
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
  buildParentInsights,
  lgsNet,
  repeatedWeakTopicNames,
  sortedQuestions,
  sortResultsByDateDesc,
  successPct,
} from '../utils/parentResultUtils';

// Mini Component: KPI Stat Card
function StatCard({ 
  title, 
  value, 
  iconClass, 
  colorClass, 
  subtitle 
}: { 
  title: string; 
  value: string | number; 
  iconClass: string; 
  colorClass: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="p-4 d-flex align-items-center">
        <div 
          className={`d-flex align-items-center justify-content-center rounded-circle bg-light-${colorClass} text-${colorClass} me-4`}
          style={{ width: '60px', height: '60px', flexShrink: 0 }}
        >
          <i className={`${iconClass} fs-2`} />
        </div>
        <div>
          <div className="text-muted small fw-semibold text-uppercase tracking-wider mb-1">{title}</div>
          <div className={`fs-2 fw-bolder text-${colorClass} lh-1 mb-1`}>{value}</div>
          {subtitle && <div className="text-muted small">{subtitle}</div>}
        </div>
      </Card.Body>
    </Card>
  );
}

export function ChildDetail() {
  const { id } = useParams<{ id: string }>();
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
        if (!cancelled) setError(err?.message ?? 'Öğrenci detayı yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const child = useMemo(() => children.find((x) => x.student.id === id), [children, id]);
  const results = useMemo<ExamResult[]>(
    () => (child ? sortResultsByDateDesc(child.results.map(mappers.toExamResult)) : []),
    [child]
  );
  
  const latest = results[0];
  const previous = results[1];
  const insights = useMemo(() => buildParentInsights(results), [results]);
  const chartRows = useMemo(() => buildParentChartRows(results), [results]);
  
  // Topics and Questions
  const topicSummaryAll = useMemo(() => aggregateWrongTopics(results).slice(0, 5), [results]);
  const repeatedTopics = useMemo(() => repeatedWeakTopicNames(results, 3), [results]);
  
  const wrongSorted = useMemo(
    () => sortedQuestions(latest?.wrongQuestions).slice(0, 20),
    [latest?.wrongQuestions]
  );

  const avgSuccess = useMemo(() => {
    if (!results.length) return 0;
    return Math.round((results.reduce((sum, r) => sum + successPct(r), 0) / results.length) * 10) / 10;
  }, [results]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error || (!child && !loading)) {
    return (
      <Container fluid className="px-0 py-5">
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error || 'Öğrenci bulunamadı.'}
        </Alert>
        <Link to="/parent" className="btn btn-outline-primary mt-2">
          Veli paneline dön
        </Link>
      </Container>
    );
  }

  if (!child) return null; // Should not reach here due to above

  const netLatest = latest ? lgsNet(latest) : 0;
  const netPrev = previous ? lgsNet(previous) : 0;
  const netDiff = netLatest - netPrev;

  return (
    <Container fluid className="px-0 pb-5">
      {/* Header Area */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
        <div>
          <Link to="/parent" className="text-decoration-none text-muted small d-inline-flex align-items-center mb-2 transition-hover">
            <i className="bi bi-arrow-left me-1" />
            Öğrencilerime Dön
          </Link>
          <div className="d-flex align-items-center">
            <div 
              className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold fs-3 me-3 shadow-sm"
              style={{ width: '50px', height: '50px', flexShrink: 0 }}
            >
              {(child.student.firstName?.[0] || '')}{(child.student.lastName?.[0] || '')}
            </div>
            <div>
              <h2 className="fw-bold mb-0 text-dark">
                {child.student.firstName} {child.student.lastName}
              </h2>
              <div className="text-muted fs-6">No: {child.student.studentNo || 'Kayıtlı Öğrenci'}</div>
            </div>
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-journal-x fs-1 mb-3 opacity-50 d-block" />
            <h5 className="text-dark">Sınav Kaydı Yok</h5>
            <p className="mb-0">Bu öğrenci için henüz sınav sonucu yüklenmemiş.</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Section 1: KPI Cards */}
          <Row className="g-4 mb-5">
            <Col xs={12} md={6} xl={3}>
              <StatCard 
                title="Ortalama Başarı" 
                value={`%${avgSuccess}`} 
                iconClass="bi-star" 
                colorClass="warning"
                subtitle="Tüm sınavların ortalaması"
              />
            </Col>
            <Col xs={12} md={6} xl={3}>
              <StatCard 
                title="Son Sınav Neti" 
                value={netLatest} 
                iconClass="bi-bullseye" 
                colorClass="primary"
                subtitle={
                  results.length >= 2 ? (
                    <span className={netDiff >= 0 ? 'text-success' : 'text-danger'}>
                      {netDiff >= 0 ? <i className="bi bi-arrow-up-right me-1" /> : <i className="bi bi-arrow-down-right me-1" />}
                      Önceki sınava göre {Math.abs(netDiff).toFixed(1)} net {netDiff >= 0 ? 'artış' : 'düşüş'}
                    </span>
                  ) : 'İlk sınav sonucu'
                }
              />
            </Col>
            <Col xs={12} md={6} xl={3}>
              <StatCard 
                title="Toplam Sınav" 
                value={results.length} 
                iconClass="bi-journal-check" 
                colorClass="success"
                subtitle="Katıldığı toplam deneme"
              />
            </Col>
            <Col xs={12} md={6} xl={3}>
              <StatCard 
                title="Zorlanılan Konu" 
                value={insights.hardestTopic ? insights.hardestTopic.substring(0, 15) + (insights.hardestTopic.length > 15 ? '...' : '') : 'Yok'} 
                iconClass="bi-exclamation-triangle" 
                colorClass="danger"
                subtitle="En sık hata yapılan alan"
              />
            </Col>
          </Row>

          {/* Section 2: Visual Analysis & Weak Topics */}
          <Row className="g-4 mb-5">
            {/* Chart */}
            <Col xs={12} xl={8}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white border-bottom-0 pt-4 pb-0">
                  <h5 className="fw-bold mb-0">Genel Başarı Trendi</h5>
                  <p className="text-muted small mb-0 mt-1">Zaman içindeki Net ve Başarı Yüzdesi değişimi</p>
                </Card.Header>
                <Card.Body className="px-4 pb-4 pt-2">
                  <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={32}>
                      <LineChart data={chartRows} margin={{ top: 20, left: -20, right: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E6EF" />
                        <XAxis 
                          dataKey="eksen" 
                          tick={{ fontSize: 11, fill: '#A1A5B7' }} 
                          tickMargin={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          yAxisId="left" 
                          tick={{ fontSize: 11, fill: '#A1A5B7' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          domain={[0, 100]} 
                          tick={{ fontSize: 11, fill: '#A1A5B7' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 0.5rem 1.5rem rgba(0, 0, 0, 0.08)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="net"
                          stroke="#009EF7" // primary
                          name="Net"
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="basari"
                          stroke="#50CD89" // success
                          name="Başarı %"
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Weak Topics */}
            <Col xs={12} xl={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white border-bottom pt-4 pb-3">
                  <h5 className="fw-bold mb-0">Odaklanılması Gerekenler</h5>
                  <p className="text-muted small mb-0 mt-1">En çok yanlış yapılan konular</p>
                </Card.Header>
                <Card.Body className="p-0">
                  <div className="list-group list-group-flush list-group-custom">
                    {topicSummaryAll.length > 0 ? (
                      topicSummaryAll.map((t) => {
                        // Max count for progress bar width scaling
                        const maxCount = topicSummaryAll[0].count || 1;
                        const pct = Math.min(100, Math.round((t.count / maxCount) * 100));
                        
                        return (
                          <div key={t.topic} className="list-group-item px-4 py-3 border-0 border-bottom">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-medium text-dark">{t.topic}</span>
                              <Badge bg="light-danger" text="danger" className="rounded-pill px-2">
                                {t.count} Yanlış
                              </Badge>
                            </div>
                            <div className="progress" style={{ height: '6px' }}>
                              <div 
                                className="progress-bar bg-danger" 
                                role="progressbar" 
                                style={{ width: `${pct}%` }} 
                                aria-valuenow={pct} 
                                aria-valuemin={0} 
                                aria-valuemax={100}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-muted">
                        <i className="bi bi-check-circle fs-2 text-success d-block mb-2 opacity-50" />
                        Henüz konu bazlı hata kaydı yok.
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Repeated Topics Insight Alert */}
          {repeatedTopics.length > 0 && (
            <Alert variant="warning" className="border-0 shadow-sm d-flex align-items-center p-4 mb-5 rounded-3">
              <i className="bi bi-lightbulb fs-1 me-4 opacity-75" />
              <div>
                <h5 className="alert-heading fw-bold mb-1">Dikkat çeken bir durum var</h5>
                <p className="mb-0 text-dark">
                  Son sınavlarda <strong>{repeatedTopics.join(', ')}</strong> konularında düzenli olarak hata yapıldığı görülüyor. Bu konuların tekrar edilmesi faydalı olabilir.
                </p>
              </div>
            </Alert>
          )}

          {/* Section 3: Exam History & Details */}
          <Row className="g-4">
            {/* Exam History */}
            <Col xs={12} lg={6}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white border-bottom pt-4 pb-3">
                  <h5 className="fw-bold mb-0">Sınav Geçmişi</h5>
                  <p className="text-muted small mb-0 mt-1">Katıldığı tüm sınavlar</p>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0 border-white align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 fw-semibold text-muted small">TARİH / SINAV</th>
                        <th className="text-center fw-semibold text-muted small">D/Y</th>
                        <th className="text-end pe-4 fw-semibold text-muted small">NET</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id}>
                          <td className="ps-4 py-3">
                            <div className="fw-bold text-dark">{r.examTitle?.trim() || 'Deneme Sınavı'}</div>
                            <div className="text-muted small">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</div>
                          </td>
                          <td className="text-center py-3">
                            <span className="text-success fw-bold">{r.correctCount}</span>
                            <span className="text-muted mx-1">/</span>
                            <span className="text-danger fw-bold">{r.wrongCount}</span>
                          </td>
                          <td className="text-end pe-4 py-3">
                            <div className="fs-5 fw-bolder text-primary">{lgsNet(r)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            {/* Last Exam Errors */}
            <Col xs={12} lg={6}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white border-bottom pt-4 pb-3">
                  <h5 className="fw-bold mb-0">Son Sınav: Hatalı Sorular</h5>
                  <p className="text-muted small mb-0 mt-1">
                    {latest?.examTitle?.trim() || 'Son sınavdaki'} yanlış ve boş bırakılan sorular
                  </p>
                </Card.Header>
                <Card.Body className="p-0">
                  {wrongSorted.length > 0 ? (
                    <Table responsive hover className="mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-4 fw-semibold text-muted small">SORU #</th>
                          <th className="fw-semibold text-muted small">KONU</th>
                          <th className="text-end pe-4 fw-semibold text-muted small">DOĞRU CEVAP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wrongSorted.map((q) => (
                          <tr key={`w-${q.questionIndex}`}>
                            <td className="ps-4 py-3">
                              <span className="fw-bold text-dark">Soru {q.questionIndex}</span>
                            </td>
                            <td className="py-3">
                              <span className="text-dark fw-medium">{q.topic || 'Belirtilmemiş'}</span>
                            </td>
                            <td className="text-end pe-4 py-3">
                              <Badge bg="light-success" text="success" className="px-3 py-2 fs-6 rounded-3">
                                {q.expectedAnswer || '?'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="p-5 text-center text-muted">
                      <div className="bg-light-success text-success rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '60px', height: '60px' }}>
                        <i className="bi bi-star-fill fs-2" />
                      </div>
                      <h6 className="fw-semibold text-dark">Harika İş!</h6>
                      <p className="mb-0 small">Son sınavda analiz edilecek hatalı soru bulunmuyor.</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}
