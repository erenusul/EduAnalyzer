/**
 * Raporlar ve istatistikler sayfası
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, ProgressBar, Form, Button, Table, Badge } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useTeacherData } from '../contexts/TeacherDataContext';

export function Reports() {
  const { students, classes, analyses, exams, examResults, getStudentsByClass, getStudentById, getClassById } =
    useTeacherData();
  const [classFilter, setClassFilter] = useState<string>('');
  const [examOverviewId, setExamOverviewId] = useState<string>('');
  const [printSummaryClassId, setPrintSummaryClassId] = useState<string>('');

  const readyExams = useMemo(() => exams.filter((e) => e.status === 'ready'), [exams]);

  const stats = useMemo(() => {
    const pdfAnalyses = analyses.filter((a) => a.type === 'pdf');
    const singleAnalyses = analyses.filter((a) => a.type === 'single');
    const totalQuestions = analyses.reduce((sum, a) => sum + a.analyzedQuestions, 0);
    const studentsWithClass = students.filter((s) => s.classId).length;
    const studentsWithoutClass = students.length - studentsWithClass;

    return {
      totalStudents: students.length,
      totalClasses: classes.length,
      totalAnalyses: analyses.length,
      pdfAnalyses: pdfAnalyses.length,
      singleAnalyses: singleAnalyses.length,
      totalQuestions,
      studentsWithClass,
      studentsWithoutClass,
    };
  }, [students, classes, analyses]);

  const topicChartData = useMemo(() => {
    const topicMap = new Map<string, number>();
    for (const r of examResults) {
      const topics = r.wrongTopics ?? [];
      for (const wt of topics) {
        const label =
          wt?.topic != null && String(wt.topic).trim() !== '' ? String(wt.topic).trim() : 'Bilinmiyor';
        const n = typeof wt?.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
        topicMap.set(label, (topicMap.get(label) ?? 0) + n);
      }
    }
    return Array.from(topicMap.entries())
      .map(([topic, count]) => ({
        name: topic.length > 18 ? topic.substring(0, 18) + '...' : topic,
        fullName: topic,
        yanlis: count,
      }))
      .sort((a, b) => b.yanlis - a.yanlis)
      .slice(0, 12);
  }, [examResults]);

  const weeklyTrendData = useMemo(() => {
    let results = examResults;
    if (classFilter) {
      const classStudentIds = new Set(getStudentsByClass(classFilter).map((s) => s.id));
      results = examResults.filter((r) => classStudentIds.has(r.studentId));
    }
    const weekMap = new Map<string, { totalWrong: number; totalCorrect: number }>();
    for (const r of results) {
      const exam = exams.find((e) => e.id === r.examId);
      const week = exam?.weekLabel ?? 'Bilinmiyor';
      const existing = weekMap.get(week);
      if (existing) {
        existing.totalWrong += r.wrongCount;
        existing.totalCorrect += r.correctCount;
      } else {
        weekMap.set(week, { totalWrong: r.wrongCount, totalCorrect: r.correctCount });
      }
    }
    return Array.from(weekMap.entries())
      .map(([week, { totalWrong, totalCorrect }]) => ({
        week,
        yanlis: totalWrong,
        dogru: totalCorrect,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [examResults, exams, classFilter, getStudentsByClass]);

  const examClassAverages = useMemo(() => {
    if (!examOverviewId) return [];
    const results = examResults.filter((r) => r.examId === examOverviewId);
    const agg = new Map<string, { sumPct: number; n: number; label: string }>();
    for (const r of results) {
      const st = students.find((s) => s.id === r.studentId);
      if (!st?.classId) continue;
      const cls = classes.find((c) => c.id === st.classId);
      if (!cls) continue;
      const total = r.correctCount + r.wrongCount;
      const pct = total > 0 ? (r.correctCount / total) * 100 : 0;
      const cur = agg.get(st.classId);
      if (cur) {
        cur.sumPct += pct;
        cur.n += 1;
      } else {
        agg.set(st.classId, { sumPct: pct, n: 1, label: cls.name });
      }
    }
    return Array.from(agg.entries())
      .map(([classId, v]) => ({
        classId,
        name: v.label.length > 16 ? v.label.slice(0, 16) + '…' : v.label,
        fullName: v.label,
        ort: Math.round((v.sumPct / v.n) * 10) / 10,
        n: v.n,
      }))
      .sort((a, b) => b.ort - a.ort);
  }, [examOverviewId, examResults, students, classes]);

  const printClassSummary = useMemo(() => {
    if (!examOverviewId) return null;
    let rows = examResults.filter((r) => r.examId === examOverviewId);
    if (printSummaryClassId) {
      const ids = new Set(getStudentsByClass(printSummaryClassId).map((s) => s.id));
      rows = rows.filter((r) => ids.has(r.studentId));
    }
    if (rows.length === 0) return null;
    const exam = readyExams.find((e) => e.id === examOverviewId);
    const totalCorrect = rows.reduce((s, r) => s + r.correctCount, 0);
    const totalWrong = rows.reduce((s, r) => s + r.wrongCount, 0);
    const denom = totalCorrect + totalWrong;
    const ortPct = denom > 0 ? Math.round((totalCorrect / denom) * 1000) / 10 : 0;
    const qMap = new Map<number, number>();
    for (const r of rows) {
      for (const w of r.wrongQuestions ?? []) {
        qMap.set(w.questionIndex, (qMap.get(w.questionIndex) ?? 0) + 1);
      }
    }
    const topWrong = [...qMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 20);
    const topicMap = new Map<string, number>();
    for (const r of rows) {
      for (const wt of r.wrongTopics ?? []) {
        const label =
          wt?.topic != null && String(wt.topic).trim() !== '' ? String(wt.topic).trim() : 'Bilinmiyor';
        const n = typeof wt?.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
        topicMap.set(label, (topicMap.get(label) ?? 0) + n);
      }
    }
    const topics = [...topicMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    const cls = printSummaryClassId ? getClassById(printSummaryClassId) : null;
    return {
      examTitle: exam?.title ?? 'Sınav',
      week: exam?.weekLabel ?? '',
      classLabel: cls?.name ?? 'Tüm sınıflar',
      n: rows.length,
      ortPct,
      topWrong,
      topics,
    };
  }, [
    examOverviewId,
    printSummaryClassId,
    examResults,
    readyExams,
    getStudentsByClass,
    getClassById,
  ]);

  const examStudentLeaderboard = useMemo(() => {
    if (!examOverviewId) return [];
    return examResults
      .filter((r) => r.examId === examOverviewId)
      .map((r) => {
        const st = getStudentById(r.studentId);
        const cl = st?.classId ? getClassById(st.classId) : undefined;
        const total = r.correctCount + r.wrongCount;
        const pct = total > 0 ? Math.round((r.correctCount / total) * 1000) / 10 : 0;
        const net = Math.round((r.correctCount - r.wrongCount / 4) * 10) / 10;
        return {
          studentId: r.studentId,
          ad: st ? `${st.firstName} ${st.lastName}` : '—',
          sinif: cl?.name ?? '—',
          pct,
          net,
          dogru: r.correctCount,
          yanlis: r.wrongCount,
        };
      })
      .sort((a, b) => b.pct - a.pct || b.net - a.net || a.ad.localeCompare(b.ad, 'tr'));
  }, [examOverviewId, examResults, getStudentById, getClassById]);

  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      { Metrik: 'Toplam Öğrenci', Değer: stats.totalStudents },
      { Metrik: 'Sınıf Sayısı', Değer: stats.totalClasses },
      { Metrik: 'Yapılan Analiz', Değer: stats.totalAnalyses },
      { Metrik: 'Analiz Edilen Soru', Değer: stats.totalQuestions },
      { Metrik: 'Sınıfa Atanmış Öğrenci', Değer: stats.studentsWithClass },
      { Metrik: 'Sınıfa Atanmamış Öğrenci', Değer: stats.studentsWithoutClass },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Özet');

    const topicExport = topicChartData.map((r) => ({
      Konu: r.fullName,
      'Yanlış Sayısı': r.yanlis,
    }));
    if (topicExport.length > 0) {
      const wsTopic = XLSX.utils.json_to_sheet(topicExport);
      XLSX.utils.book_append_sheet(wb, wsTopic, 'Konu Bazlı Yanlış');
    }

    const trendExport = weeklyTrendData.map((r) => ({
      Hafta: r.week,
      'Toplam Doğru': r.dogru,
      'Toplam Yanlış': r.yanlis,
    }));
    if (trendExport.length > 0) {
      const wsTrend = XLSX.utils.json_to_sheet(trendExport);
      XLSX.utils.book_append_sheet(wb, wsTrend, 'Haftalık Trend');
    }

    const fileName = `rapor-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [stats, topicChartData, weeklyTrendData]);

  return (
    <div>
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1">Raporlar</h4>
          <p className="text-muted mb-0">Genel istatistikler ve özet bilgiler.</p>
        </div>
        <Button
          variant="outline-success"
          onClick={handleExportExcel}
          aria-label="Raporu Excel dosyasına aktar"
        >
          <i className="bi bi-file-earmark-excel me-2" />
          Excel&apos;e Aktar
        </Button>
      </div>

      <Row className="g-4 mb-4">
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-primary bg-opacity-10 text-primary p-3">
                  <i className="bi bi-people fs-4" />
                </div>
                <div>
                  <div className="fs-2 fw-bold">{stats.totalStudents}</div>
                  <div className="text-muted small">Toplam Öğrenci</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-success bg-opacity-10 text-success p-3">
                  <i className="bi bi-collection fs-4" />
                </div>
                <div>
                  <div className="fs-2 fw-bold">{stats.totalClasses}</div>
                  <div className="text-muted small">Sınıf</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-info bg-opacity-10 text-info p-3">
                  <i className="bi bi-file-earmark-bar-graph fs-4" />
                </div>
                <div>
                  <div className="fs-2 fw-bold">{stats.totalAnalyses}</div>
                  <div className="text-muted small">Yapılan Analiz</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-warning bg-opacity-10 text-warning p-3">
                  <i className="bi bi-question-circle fs-4" />
                </div>
                <div>
                  <div className="fs-2 fw-bold">{stats.totalQuestions}</div>
                  <div className="text-muted small">Analiz Edilen Soru</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom py-3">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-pie-chart me-2" />
                Öğrenci Dağılımı
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Sınıfa atanmış</span>
                  <span className="fw-semibold">{stats.studentsWithClass}</span>
                </div>
                <ProgressBar
                  now={
                    stats.totalStudents ? (stats.studentsWithClass / stats.totalStudents) * 100 : 0
                  }
                  variant="success"
                />
              </div>
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Sınıfa atanmamış</span>
                  <span className="fw-semibold">{stats.studentsWithoutClass}</span>
                </div>
                <ProgressBar
                  now={
                    stats.totalStudents
                      ? (stats.studentsWithoutClass / stats.totalStudents) * 100
                      : 0
                  }
                  variant="secondary"
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom py-3">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-graph-up me-2" />
                Analiz Türleri
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="rounded-2 bg-primary bg-opacity-10 text-primary p-2">
                  <i className="bi bi-file-earmark-pdf fs-5" />
                </div>
                <div className="flex-grow-1">
                  <div className="fw-medium">PDF Sınav Analizi</div>
                  <div className="text-muted small">{stats.pdfAnalyses} analiz</div>
                </div>
                <div className="fw-bold">{stats.pdfAnalyses}</div>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-2 bg-secondary bg-opacity-10 text-secondary p-2">
                  <i className="bi bi-chat-quote fs-5" />
                </div>
                <div className="flex-grow-1">
                  <div className="fw-medium">Tek Soru Analizi</div>
                  <div className="text-muted small">{stats.singleAnalyses} analiz</div>
                </div>
                <div className="fw-bold">{stats.singleAnalyses}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {topicChartData.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0">
              <i className="bi bi-bar-chart me-2" />
              Konu Bazlı Yanlış Dağılımı
            </h6>
          </Card.Header>
          <Card.Body>
            <div
              className="w-100"
              style={{ minWidth: 0 }}
              role="img"
              aria-label="Konu bazlı yanlış dağılımı grafiği"
            >
              <ResponsiveContainer width="100%" height={320} debounce={32}>
                <BarChart data={topicChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip
                    formatter={(value: number | undefined) => [value ?? 0, 'Yanlış']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  />
                  <Bar
                    dataKey="yanlis"
                    fill="var(--bs-primary)"
                    name="Yanlış"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      )}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white border-bottom py-3">
          <h6 className="fw-semibold mb-0">
            <i className="bi bi-columns-gap me-2" />
            Sınav bazlı sınıf ve öğrenci karşılaştırması
          </h6>
          <p className="text-muted small mb-0 mt-2">
            Tek bir sınav seçerek tüm sınıfların ortalama başarısını ve öğrencileri sıralı görün (sınıfı olan
            öğrenciler).
          </p>
        </Card.Header>
        <Card.Body>
          <Form.Group className="mb-4" style={{ maxWidth: 420 }}>
            <Form.Label htmlFor="reports-exam-overview" className="fw-medium">
              Sınav
            </Form.Label>
            <Form.Select
              id="reports-exam-overview"
              value={examOverviewId}
              onChange={(e) => setExamOverviewId(e.target.value)}
              aria-label="Karşılaştırma için sınav seçin"
            >
              <option value="">Sınav seçin</option>
              {readyExams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.weekLabel})
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-4" style={{ maxWidth: 420 }}>
            <Form.Label htmlFor="reports-print-class" className="fw-medium">
              Yazdırılabilir özet için sınıf (isteğe bağlı)
            </Form.Label>
            <Form.Select
              id="reports-print-class"
              value={printSummaryClassId}
              onChange={(e) => setPrintSummaryClassId(e.target.value)}
              aria-label="Özet raporda sınıf filtresi"
            >
              <option value="">Tüm sınıflar</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {!examOverviewId ? (
            <p className="text-muted small mb-0">Karşılaştırma için yukarıdan bir sınav seçin.</p>
          ) : examClassAverages.length === 0 && examStudentLeaderboard.length === 0 ? (
            <p className="text-muted mb-0">Bu sınav için henüz kayıtlı sonuç yok.</p>
          ) : (
            <>
              {examClassAverages.length > 0 && (
                <div className="mb-4">
                  <h6 className="fw-semibold small text-uppercase text-muted mb-3">Sınıf ortalamaları</h6>
                  <div className="w-100" style={{ minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={260} debounce={32}>
                      <BarChart data={examClassAverages} layout="vertical" margin={{ left: 16, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip
                          formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Ortalama başarı']}
                          labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''}
                        />
                        <Bar dataKey="ort" fill="var(--bs-primary)" name="Ortalama %" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {examStudentLeaderboard.length > 0 && (
                <>
                  <h6 className="fw-semibold small text-uppercase text-muted mb-3">
                    Öğrenciler (başarıya göre sıralı)
                  </h6>
                  <Table responsive hover size="sm" className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Öğrenci</th>
                        <th>Sınıf</th>
                        <th>D / Y</th>
                        <th>Başarı %</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examStudentLeaderboard.map((row, idx) => (
                        <tr key={row.studentId}>
                          <td className="text-muted">{idx + 1}</td>
                          <td className="fw-medium">{row.ad}</td>
                          <td>{row.sinif}</td>
                          <td>
                            {row.dogru} / {row.yanlis}
                          </td>
                          <td>
                            <Badge bg={row.pct >= 70 ? 'success' : row.pct >= 50 ? 'warning' : 'danger'}>
                              {row.pct}%
                            </Badge>
                          </td>
                          <td>{row.net}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {printClassSummary && (
        <Card className="border-0 shadow-sm mb-4" id="class-summary-print">
          <Card.Header className="bg-white border-bottom py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h6 className="fw-semibold mb-0">
              <i className="bi bi-printer me-2" />
              Sınıf özeti (yazdır / PDF)
            </h6>
            <Button
              variant="outline-primary"
              size="sm"
              type="button"
              onClick={() => window.print()}
              aria-label="Özeti yazdır veya PDF olarak kaydet"
            >
              <i className="bi bi-printer me-1" />
              Yazdır
            </Button>
          </Card.Header>
          <Card.Body>
            <p className="small text-muted mb-3">
              Tarayıcı yazdır penceresinde hedef olarak PDF seçerek kaydedebilirsiniz. Veriler seçili
              sınav ve sınıf filtresine göredir.
            </p>
            <h5 className="fw-bold mb-1">{printClassSummary.examTitle}</h5>
            <p className="small mb-3">
              {printClassSummary.week && <span>{printClassSummary.week} · </span>}
              {printClassSummary.classLabel} · {printClassSummary.n} öğrenci kaydı
            </p>
            <div className="mb-4">
              <div className="text-muted small">Sınıf ortalaması (doğru oranı)</div>
              <div className="fs-3 fw-bold text-primary">{printClassSummary.ortPct}%</div>
            </div>
            {printClassSummary.topWrong.length > 0 ? (
              <div className="mb-4">
                <h6 className="fw-semibold small text-uppercase text-muted mb-2">
                  En çok yanlış yapılan sorular
                </h6>
                <Table responsive size="sm" bordered className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Soru no</th>
                      <th>Yanlış sayısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printClassSummary.topWrong.map(([q, c]) => (
                      <tr key={q}>
                        <td>{q}</td>
                        <td>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <p className="small text-muted mb-4">Bu kümeste yanlış soru kaydı yok.</p>
            )}
            {printClassSummary.topics.length > 0 && (
              <div>
                <h6 className="fw-semibold small text-uppercase text-muted mb-2">
                  Konu bazlı yanlışlar
                </h6>
                <Table responsive size="sm" bordered className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Konu</th>
                      <th>Yanlış</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printClassSummary.topics.map(([t, c]) => (
                      <tr key={t}>
                        <td>{t}</td>
                        <td>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {weeklyTrendData.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white border-bottom py-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-graph-up me-2" />
                Haftalık Yanlış Trend
              </h6>
              <Form.Select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                style={{ width: 'auto' }}
                aria-label="Sınıf filtresi"
              >
                <option value="">Tüm sınıflar</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </div>
          </Card.Header>
          <Card.Body>
            <div
              className="w-100"
              style={{ minWidth: 0 }}
              role="img"
              aria-label="Haftalık yanlış trend grafiği"
            >
              <ResponsiveContainer width="100%" height={250} debounce={32}>
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="dogru"
                    stroke="var(--bs-success)"
                    name="Toplam Doğru"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="yanlis"
                    stroke="var(--bs-danger)"
                    name="Toplam Yanlış"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      )}

      <Card className="border-0 shadow-sm mt-4">
        <Card.Header className="bg-white border-bottom py-3">
          <h6 className="fw-semibold mb-0">
            <i className="bi bi-lightning me-2" />
            Hızlı Erişim
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-4">
              <Link to="/dashboard/ogrenci-takibi" className="text-decoration-none">
                <Card className="border h-100 text-dark">
                  <Card.Body className="d-flex align-items-center gap-3">
                    <i className="bi bi-people fs-4 text-primary" />
                    <div>
                      <div className="fw-medium">Öğrenci Takibi</div>
                      <div className="small text-muted">Öğrencileri yönet</div>
                    </div>
                  </Card.Body>
                </Card>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/dashboard/siniflar" className="text-decoration-none">
                <Card className="border h-100 text-dark">
                  <Card.Body className="d-flex align-items-center gap-3">
                    <i className="bi bi-collection fs-4 text-success" />
                    <div>
                      <div className="fw-medium">Sınıf Yönetimi</div>
                      <div className="small text-muted">Sınıfları düzenle</div>
                    </div>
                  </Card.Body>
                </Card>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/dashboard/analiz-gecmisi" className="text-decoration-none">
                <Card className="border h-100 text-dark">
                  <Card.Body className="d-flex align-items-center gap-3">
                    <i className="bi bi-clock-history fs-4 text-info" />
                    <div>
                      <div className="fw-medium">Analiz Geçmişi</div>
                      <div className="small text-muted">Geçmiş analizlere bak</div>
                    </div>
                  </Card.Body>
                </Card>
              </Link>
            </div>
            <div className="col-md-4">
              <Link to="/dashboard/sinif-analizi" className="text-decoration-none">
                <Card className="border h-100 text-dark">
                  <Card.Body className="d-flex align-items-center gap-3">
                    <i className="bi bi-bar-chart fs-4 text-warning" />
                    <div>
                      <div className="fw-medium">Sınıf Analizi</div>
                      <div className="small text-muted">Konu bazlı analiz</div>
                    </div>
                  </Card.Body>
                </Card>
              </Link>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
