/**
 * Raporlar ve istatistikler sayfası
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, ProgressBar, Form } from 'react-bootstrap';
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
  const { students, classes, analyses, exams, examResults, getStudentsByClass } = useTeacherData();
  const [classFilter, setClassFilter] = useState<string>('');

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
      for (const wt of r.wrongTopics) {
        topicMap.set(wt.topic, (topicMap.get(wt.topic) ?? 0) + wt.count);
      }
    }
    return Array.from(topicMap.entries())
      .map(([topic, count]) => ({ name: topic.length > 18 ? topic.substring(0, 18) + '...' : topic, fullName: topic, yanlis: count }))
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
      .map(([week, { totalWrong, totalCorrect }]) => ({ week, yanlis: totalWrong, dogru: totalCorrect }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [examResults, exams, classFilter, getStudentsByClass]);

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Raporlar</h4>
        <p className="text-muted mb-0">
          Genel istatistikler ve özet bilgiler.
        </p>
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
                  now={stats.totalStudents ? (stats.studentsWithClass / stats.totalStudents) * 100 : 0}
                  variant="success"
                />
              </div>
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Sınıfa atanmamış</span>
                  <span className="fw-semibold">{stats.studentsWithoutClass}</span>
                </div>
                <ProgressBar
                  now={stats.totalStudents ? (stats.studentsWithoutClass / stats.totalStudents) * 100 : 0}
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
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip
                    formatter={(value: number | undefined) => [value ?? 0, 'Yanlış']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  />
                  <Bar dataKey="yanlis" fill="var(--bs-primary)" name="Yanlış" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="dogru" stroke="var(--bs-success)" name="Toplam Doğru" strokeWidth={2} />
                  <Line type="monotone" dataKey="yanlis" stroke="var(--bs-danger)" name="Toplam Yanlış" strokeWidth={2} />
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
