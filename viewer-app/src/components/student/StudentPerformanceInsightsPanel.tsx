/**
 * Öğretmen ve veli panellerinde ortak: KPI kartları, trend grafiği, zayıf konular,
 * sınav geçmişi tablosu ve son sınav hataları.
 */

import { useMemo, useState } from 'react';
import { Alert, Badge, Card, Col, Modal, Row, Table } from 'react-bootstrap';
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
import type { ExamResult } from '../../types/teacher';
import {
  aggregateWrongTopicsFromResults,
  buildParentChartRows,
  lgsNet,
  repeatedWeakTopicNamesFromResults,
  sortResultsByDateDesc,
  sortedQuestions,
  successPct,
  wrongTopicBreakdownForExamResult,
} from '../../utils/parentResultUtils';
import {
  getPreviousExamResult,
  isSameTopicWrongAgain,
  listTopicImprovementsSincePrevious,
  normTopicKey,
} from '../../utils/topicProgressFeedback';

function StatCard({
  title,
  value,
  iconClass,
  colorClass,
  subtitle,
  layout = 'inline',
}: {
  title: string;
  value: string | number;
  iconClass: string;
  colorClass: string;
  subtitle?: React.ReactNode;
  layout?: 'inline' | 'stacked';
}) {
  const stacked = layout === 'stacked';
  return (
    <Card className="border-0 shadow-sm h-100" lang="tr">
      <Card.Body
        className={
          stacked
            ? 'p-3 p-lg-4 d-flex flex-column align-items-start text-start gap-3'
            : 'p-3 p-lg-4 d-flex flex-column flex-lg-row align-items-center align-items-lg-center text-center text-lg-start gap-3'
        }
      >
        <div
          className={`d-flex align-items-center justify-content-center rounded-circle bg-light-${colorClass} text-${colorClass} flex-shrink-0 ${stacked ? '' : 'me-lg-4'}`}
          style={{ width: stacked ? '52px' : '60px', height: stacked ? '52px' : '60px' }}
        >
          <i className={`${iconClass} ${stacked ? 'fs-3' : 'fs-2'}`} />
        </div>
        <div className="min-w-0 flex-grow-1 w-100">
          <div className="text-muted small fw-semibold text-uppercase tracking-wider mb-1">{title}</div>
          <div className={`fw-bolder text-${colorClass} mb-1 text-wrap ${stacked ? 'fs-4 lh-sm' : 'fs-2 lh-1'}`}>
            {value}
          </div>
          {subtitle && <div className="text-muted small text-wrap">{subtitle}</div>}
        </div>
      </Card.Body>
    </Card>
  );
}

export interface StudentPerformanceInsightsPanelProps {
  results: ExamResult[];
  /** Dışarıdan ana kapsayıcıya marjin vb. için */
  className?: string;
}

export function StudentPerformanceInsightsPanel({ results, className }: StudentPerformanceInsightsPanelProps) {
  const sortedResults = useMemo(() => sortResultsByDateDesc(results), [results]);
  const chartRows = useMemo(() => buildParentChartRows(sortedResults), [sortedResults]);
  const topicSummaryAll = useMemo(() => aggregateWrongTopicsFromResults(sortedResults).slice(0, 5), [sortedResults]);
  const repeatedTopics = useMemo(() => repeatedWeakTopicNamesFromResults(sortedResults, 3), [sortedResults]);

  const latest = sortedResults[0];
  const previous = sortedResults[1];

  const netLatest = latest ? lgsNet(latest) : 0;
  const netPrev = previous ? lgsNet(previous) : 0;
  const netDiff = netLatest - netPrev;

  const avgSuccess = useMemo(() => {
    if (!sortedResults.length) return 0;
    return (
      Math.round(
        (sortedResults.reduce((sum, r) => sum + successPct(r), 0) / sortedResults.length) * 10
      ) / 10
    );
  }, [sortedResults]);

  const wrongSorted = useMemo(
    () => sortedQuestions(latest?.wrongQuestions).slice(0, 20),
    [latest?.wrongQuestions]
  );

  const previousForCompare =
    latest && sortedResults.length >= 2 ? getPreviousExamResult(sortedResults, latest) : null;

  const topicImprovements = useMemo(
    () => (latest ? listTopicImprovementsSincePrevious(latest, previousForCompare) : []),
    [latest, previousForCompare]
  );
  const improvementKeySet = useMemo(
    () => new Set(topicImprovements.map((x) => x.topicKey)),
    [topicImprovements]
  );

  const [examTopicModalResult, setExamTopicModalResult] = useState<ExamResult | null>(null);

  const examTopicModalRows = useMemo(
    () => (examTopicModalResult ? wrongTopicBreakdownForExamResult(examTopicModalResult) : []),
    [examTopicModalResult]
  );

  if (sortedResults.length === 0) {
    return (
      <div className={className}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-journal-x fs-1 mb-3 opacity-50 d-block" />
            <h5 className="text-dark">Sınav Kaydı Yok</h5>
            <p className="mb-0">Bu öğrenci için henüz sınav sonucu yüklenmemiş.</p>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <Row className="g-4 mb-3 mb-lg-4">
        <Col xs={12} md={6} xl={4}>
          <StatCard
            title="Ortalama Başarı"
            value={`%${avgSuccess}`}
            iconClass="bi-star"
            colorClass="warning"
            subtitle="Tüm sınavların ortalaması"
          />
        </Col>
        <Col xs={12} md={6} xl={4}>
          <StatCard
            title="Son Sınav Neti"
            value={netLatest}
            iconClass="bi-bullseye"
            colorClass="primary"
            subtitle={
              sortedResults.length >= 2 ? (
                <span className={netDiff >= 0 ? 'text-success' : 'text-danger'}>
                  {netDiff >= 0 ? (
                    <i className="bi bi-arrow-up-right me-1" />
                  ) : (
                    <i className="bi bi-arrow-down-right me-1" />
                  )}
                  Önceki sınava göre {Math.abs(netDiff).toFixed(1)} net {netDiff >= 0 ? 'artış' : 'düşüş'}
                </span>
              ) : (
                'İlk sınav sonucu'
              )
            }
          />
        </Col>
        <Col xs={12} md={12} xl={4}>
          <StatCard
            title="Toplam Sınav"
            value={sortedResults.length}
            iconClass="bi-journal-check"
            colorClass="success"
            subtitle="Katıldığı toplam deneme"
          />
        </Col>
      </Row>

      <Row className="g-4 mb-5">
        <Col xs={12}>
          <StatCard
            title="Zorlanılan Konu"
            value={
              topicSummaryAll[0]?.count && topicSummaryAll[0].count > 0
                ? topicSummaryAll[0].topic
                : 'Veri yok'
            }
            iconClass="bi-exclamation-triangle"
            colorClass="danger"
            layout="stacked"
            subtitle={
              topicSummaryAll[0]?.count && topicSummaryAll[0].count > 0
                ? `Tüm sınavlarda ${topicSummaryAll[0].count} yanlış`
                : 'Konu bazlı hata verisi henüz yok'
            }
          />
        </Col>
      </Row>

      {topicImprovements.length > 0 && (
        <Alert variant="success" className="border-0 shadow-sm d-flex align-items-start p-4 mb-5 rounded-3">
          <i className="bi bi-check-circle fs-1 me-4 opacity-75 flex-shrink-0" />
          <div>
            <h5 className="alert-heading fw-bold mb-1">Önceki sınavla karşılaştırmalı gelişim</h5>
            <p className="mb-0 text-dark">
              Bir önceki sınavda hata yaptığın{' '}
              <strong>{topicImprovements.map((x) => x.displayName).join(', ')}</strong> konularında bu sınavda
              yanlış kaydı yok; aynı konularda doğru yanıtlamış olman veya bu konuda hata yapmamış olman olumlu bir
              sinyal.
            </p>
          </div>
        </Alert>
      )}

      {sortedResults.length >= 2 && topicImprovements.length === 0 && (
        <Alert variant="light" className="border shadow-sm mb-5 rounded-3 small">
          <div className="d-flex align-items-start gap-3">
            <i className="bi bi-info-circle text-primary fs-4 flex-shrink-0" aria-hidden />
            <div className="text-dark">
              <div className="fw-semibold mb-1">Önceki sınavla otomatik karşılaştırma</div>
              <p className="mb-0 text-muted">
                Yeşil özet kutusu yalnızca <strong>bir önceki sınavda yanlış olup son sınavda o konuda yanlış kaydı
                kalmayan</strong> konular için gösterilir. Son sınavda aynı konularda hâlâ eksik varsa özet
                görünmez; &quot;Odaklanılması Gerekenler&quot; satırlarında düzelme varsa yeşil not düşer. &quot;Son
                Sınav: Hatalı Sorular&quot; tablosunda, satır altı uyarı ise bir önceki sınavda <strong>o konuda da</strong>{' '}
                hata olmuşsa çıkar.
              </p>
            </div>
          </div>
        </Alert>
      )}

      <Row className="g-4 mb-5">
        <Col xs={12} xl={8}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom-0 pt-4 pb-0">
              <h5 className="fw-bold mb-0">Genel Başarı Trendi</h5>
              <p className="text-muted small mb-0 mt-1">Zaman içindeki Net ve Başarı Yüzdesi değişimi</p>
            </Card.Header>
            <Card.Body className="px-3 px-lg-4 pb-4 pt-2">
              <div className="w-100" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={300} debounce={32}>
                  <LineChart data={chartRows} margin={{ top: 20, left: -20, right: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E6EF" />
                    <XAxis
                      dataKey="eksen"
                      tick={{ fontSize: 11, fill: '#A1A5B7' }}
                      tickMargin={10}
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
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 0.5rem 1.5rem rgba(0, 0, 0, 0.08)',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="net"
                      stroke="#009EF7"
                      name="Net"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="basari"
                      stroke="#50CD89"
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
                    const maxCount = topicSummaryAll[0].count || 1;
                    const pct = Math.min(100, Math.round((t.count / maxCount) * 100));
                    return (
                      <div key={t.topic} className="list-group-item px-4 py-3 border-0 border-bottom">
                        <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                          <span className="fw-medium text-dark">{t.topic}</span>
                          <Badge bg="light-danger" text="danger" className="rounded-pill px-2 flex-shrink-0">
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
                        {improvementKeySet.has(normTopicKey(t.topic)) ? (
                          <span className="small text-success d-block mt-2">
                            <i className="bi bi-arrow-up-circle-fill me-1" aria-hidden />
                            Önceki sınavda hatalıydı; son sınavda bu konuda yanlış kaydı yok.
                          </span>
                        ) : null}
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

      {repeatedTopics.length > 0 && (
        <Alert variant="warning" className="border-0 shadow-sm d-flex align-items-center p-4 mb-5 rounded-3">
          <i className="bi bi-lightbulb fs-1 me-4 opacity-75 flex-shrink-0" />
          <div>
            <h5 className="alert-heading fw-bold mb-1">Dikkat çeken bir durum var</h5>
            <p className="mb-0 text-dark">
              Son sınavlarda <strong>{repeatedTopics.join(', ')}</strong> konularında düzenli olarak hata yapıldığı görülüyor.
              Bu konuların tekrar edilmesi faydalı olabilir.
            </p>
          </div>
        </Alert>
      )}

      <Row className="g-4 mb-5">
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom pt-4 pb-3">
              <h5 className="fw-bold mb-0">Sınav Geçmişi</h5>
              <p className="text-muted small mb-0 mt-1">
                Katıldığı tüm sınavlar. Bir satıra tıklayın; yanlış yapılan konular listelenir.
              </p>
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
                  {sortedResults.map((r) => {
                    const title = r.examTitle?.trim() || 'Deneme Sınavı';
                    return (
                      <tr
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => setExamTopicModalResult(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExamTopicModalResult(r);
                          }
                        }}
                        aria-label={`${title}: yanlış konuları göster`}
                      >
                        <td className="ps-4 py-3">
                          <div className="fw-bold text-dark">{title}</div>
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
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom pt-4 pb-3">
              <h5 className="fw-bold mb-0">Son Sınav: Hatalı Sorular</h5>
              <p className="text-muted small mb-0 mt-1">
                {latest?.examTitle?.trim() || 'Son sınavdaki'} yanlış ve boş bırakılan sorular. Konu sütununda, bir
                önceki sınavda da aynı konuda hata varsa satır altı uyarı gösterilir.
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
                          <span className="text-dark fw-medium d-block">{q.topic || 'Belirtilmemiş'}</span>
                          {previousForCompare && isSameTopicWrongAgain(q, previousForCompare) ? (
                            <span className="small text-warning d-block mt-1">
                              <i className="bi bi-arrow-repeat me-1" aria-hidden />
                              Bir önceki sınavda da bu konuda hata kaydı var.
                            </span>
                          ) : null}
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
                  <div
                    className="bg-light-success text-success rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: '60px', height: '60px' }}
                  >
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

      <Modal show={examTopicModalResult != null} onHide={() => setExamTopicModalResult(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="text-break">
            Yanlış konular — {examTopicModalResult?.examTitle?.trim() || 'Sınav'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {examTopicModalResult && (
            <>
              <p className="text-muted small mb-3">
                {new Date(examTopicModalResult.createdAt).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · Doğru / Yanlış: {examTopicModalResult.correctCount} / {examTopicModalResult.wrongCount} · Net:{' '}
                {lgsNet(examTopicModalResult)}
              </p>
              {examTopicModalRows.length === 0 ? (
                <Alert variant="light" className="border mb-0 small text-muted">
                  Bu sınav için konu bazlı yanlış özeti yok (tüm sorular doğru olabilir veya ayrıntılı kayıt
                  bulunmuyor).
                </Alert>
              ) : (
                <Table responsive hover className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-0 fw-semibold text-muted small">KONU</th>
                      <th className="text-end pe-0 fw-semibold text-muted small">YANLIŞ SAYISI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examTopicModalRows.map((row) => (
                      <tr key={row.topic}>
                        <td className="py-3 ps-0 fw-medium">{row.topic}</td>
                        <td className="text-end py-3 pe-0">
                          <Badge bg="danger" className="fw-normal">
                            {row.count}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <button type="button" className="btn btn-light btn-sm" onClick={() => setExamTopicModalResult(null)}>
            Kapat
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
