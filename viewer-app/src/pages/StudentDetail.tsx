/**
 * Öğrenci detay sayfası - bilgiler, sınav sonuçları, konu hataları, haftalık grafik
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Card, Form, Button, Badge, Row, Col, Table, Modal, Alert, Spinner } from 'react-bootstrap';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';
import type { ApiError } from '../services/apiClient';
import { studentsApi, type ParentCandidate, type StudentParentLink } from '../services/backendApi';
import type { AnalysisRecord, Exam, ExamResult } from '../types/teacher';
import {
  buildExamQuestionTopicMap,
  resolveWrongQuestionTopicLabel,
} from '../utils/examQuestionTopics';
import { sortResultsByDateDesc } from '../utils/parentResultUtils';
import { StudentPerformanceInsightsPanel } from '../components/student/StudentPerformanceInsightsPanel';

interface TopicSummaryRow {
  topic: string;
  wrongCount: number;
  examOccurrences: number;
  lastExamSummary: string;
}

function aggregateTopicSummaryForResults(
  results: ExamResult[],
  exams: Exam[],
  analyses: AnalysisRecord[]
): TopicSummaryRow[] {
  type Acc = { count: number; examIds: Set<string>; lastSort: number; lastSummary: string };
  const map = new Map<string, Acc>();

  const bump = (
    topicKey: string,
    examId: string,
    examSort: number,
    summary: string,
    delta: number
  ) => {
    if (delta <= 0) return;
    let acc = map.get(topicKey);
    if (!acc) {
      acc = { count: 0, examIds: new Set(), lastSort: -1, lastSummary: '' };
      map.set(topicKey, acc);
    }
    acc.count += delta;
    acc.examIds.add(examId);
    if (examSort >= acc.lastSort) {
      acc.lastSort = examSort;
      acc.lastSummary = summary;
    }
  };

  for (const result of results) {
    const exam = exams.find((e) => e.id === result.examId);
    if (!exam) continue;
    const analysis = analyses.find((a) => a.id === exam.analysisId);
    const qTopicMap = buildExamQuestionTopicMap(analysis, exam);
    const examSort = Date.parse(`${exam.date}T12:00:00`);
    const sortKey = Number.isFinite(examSort) ? examSort : 0;
    const summary = `${exam.title} · ${exam.weekLabel}`;

    const wq = result.wrongQuestions ?? [];
    if (wq.length > 0) {
      for (const w of wq) {
        const label = resolveWrongQuestionTopicLabel(w.questionIndex, w.topic, qTopicMap);
        bump(label, exam.id, sortKey, summary, 1);
      }
    } else {
      for (const wt of result.wrongTopics ?? []) {
        const label =
          wt?.topic != null && String(wt.topic).trim() !== ''
            ? String(wt.topic).trim()
            : 'Bilinmiyor';
        const n = typeof wt?.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
        bump(label, exam.id, sortKey, summary, n);
      }
    }
  }

  return Array.from(map.entries())
    .map(([topic, acc]) => ({
      topic,
      wrongCount: acc.count,
      examOccurrences: acc.examIds.size,
      lastExamSummary: acc.lastSummary || '—',
    }))
    .sort((a, b) => b.wrongCount - a.wrongCount);
}

export function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    getStudentById,
    getClassById,
    classes,
    updateStudent,
    assignStudentToClass,
    exams,
    analyses,
    getResultsByStudent,
    updateExamResult,
    deleteExamResult,
  } = useTeacherData();
  const { showToast } = useToast();
  const [mobilePassword, setMobilePassword] = useState('');
  const [editTarget, setEditTarget] = useState<ExamResult | null>(null);
  const [editCorrect, setEditCorrect] = useState(0);
  const [editWrong, setEditWrong] = useState(0);
  const [editKeepTopics, setEditKeepTopics] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [suspiciousTarget, setSuspiciousTarget] = useState<ExamResult | null>(null);
  const [resultActionLoading, setResultActionLoading] = useState(false);
  const [linkedParents, setLinkedParents] = useState<StudentParentLink[]>([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [parentsFetchError, setParentsFetchError] = useState<string | null>(null);
  const [addParentModalOpen, setAddParentModalOpen] = useState(false);
  const [parentCandidates, setParentCandidates] = useState<ParentCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [parentActionLoading, setParentActionLoading] = useState(false);
  const [newParentEmail, setNewParentEmail] = useState('');
  const [newParentPassword, setNewParentPassword] = useState('');
  const [newParentDisplayName, setNewParentDisplayName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [createParentLoading, setCreateParentLoading] = useState(false);
  const [topicSummaryExamFilter, setTopicSummaryExamFilter] = useState<string>('');

  const student = id ? getStudentById(id) : null;

  const studentResults = useMemo(
    () => (student ? getResultsByStudent(student.id) : []),
    [student, getResultsByStudent]
  );

  /** Veli paneliyle uyumlu özet bileşeni için sınav başlıkları doldurulur. */
  const performanceInsightsResults = useMemo(() => {
    const list = student ? sortResultsByDateDesc(getResultsByStudent(student.id)) : [];
    return list.map((r) => ({
      ...r,
      examTitle: r.examTitle?.trim() || exams.find((e) => e.id === r.examId)?.title || undefined,
    }));
  }, [student, getResultsByStudent, exams]);

  const examOptionsForStudent = useMemo(() => {
    const byId = new Map<string, { examId: string; label: string; sortKey: number }>();
    for (const r of studentResults) {
      const exam = exams.find((e) => e.id === r.examId);
      if (!exam) continue;
      const sortKey = Date.parse(`${exam.date}T12:00:00`);
      const sk = Number.isFinite(sortKey) ? sortKey : 0;
      const titleShort = exam.title.length > 42 ? `${exam.title.slice(0, 40)}…` : exam.title;
      byId.set(exam.id, {
        examId: exam.id,
        label: `${titleShort} (${exam.weekLabel})`,
        sortKey: sk,
      });
    }
    return Array.from(byId.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [studentResults, exams]);

  useEffect(() => {
    if (
      topicSummaryExamFilter &&
      !examOptionsForStudent.some((o) => o.examId === topicSummaryExamFilter)
    ) {
      setTopicSummaryExamFilter('');
    }
  }, [topicSummaryExamFilter, examOptionsForStudent]);

  const resultsForTopicSummary = useMemo(() => {
    if (!topicSummaryExamFilter) return studentResults;
    return studentResults.filter((r) => r.examId === topicSummaryExamFilter);
  }, [studentResults, topicSummaryExamFilter]);

  const topicSummary = useMemo(
    () => aggregateTopicSummaryForResults(resultsForTopicSummary, exams, analyses),
    [resultsForTopicSummary, exams, analyses]
  );

  const topicSummaryExamLabel = useMemo(() => {
    if (!topicSummaryExamFilter) return null;
    return examOptionsForStudent.find((o) => o.examId === topicSummaryExamFilter)?.label ?? null;
  }, [topicSummaryExamFilter, examOptionsForStudent]);

  const weeklyChartData = useMemo(() => {
    type Row = {
      sortKey: number;
      week: string;
      examTitle: string;
      barAxisLabel: string;
      dogru: number;
      yanlis: number;
      net: number;
      basariPct: number;
      toplamSoru: number;
    };
    const raw = studentResults
      .map((r) => {
        const exam = exams.find((e) => e.id === r.examId);
        if (!exam) return null;
        const sortKey = Date.parse(`${exam.date}T12:00:00`);
        const total = r.correctCount + r.wrongCount;
        const pct = total > 0 ? Math.round((r.correctCount / total) * 1000) / 10 : 0;
        const titleShort =
          exam.title.length > 18 ? `${exam.title.slice(0, 16)}…` : exam.title;
        const barAxisLabel = `${titleShort} · ${exam.weekLabel}`;
        return {
          sortKey: Number.isFinite(sortKey) ? sortKey : 0,
          week: exam.weekLabel,
          examTitle: exam.title,
          barAxisLabel,
          dogru: r.correctCount,
          yanlis: r.wrongCount,
          net: Math.round((r.correctCount - r.wrongCount / 4) * 10) / 10,
          basariPct: pct,
          toplamSoru: total,
        } satisfies Row;
      })
      .filter(Boolean) as Row[];

    raw.sort((a, b) => a.sortKey - b.sortKey);

    const dupWeek = new Map<string, number>();
    return raw.map((r) => {
      const n = (dupWeek.get(r.week) ?? 0) + 1;
      dupWeek.set(r.week, n);
      const barAxisLabel =
        n > 1 ? `${r.barAxisLabel} (${n})` : r.barAxisLabel;
      return { ...r, barAxisLabel };
    });
  }, [studentResults, exams]);

  const examPerformanceChartHeight = useMemo(
    () => Math.min(420, Math.max(260, weeklyChartData.length * 56 + 120)),
    [weeklyChartData.length]
  );

  const loadLinkedParents = useCallback(async () => {
    if (!student?.id) return;
    setParentsLoading(true);
    setParentsFetchError(null);
    try {
      const data = await studentsApi.getStudentParents(student.id);
      setLinkedParents(data);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as ApiError).message)
          : 'Veli listesi yüklenemedi.';
      setParentsFetchError(msg);
      setLinkedParents([]);
    } finally {
      setParentsLoading(false);
    }
  }, [student?.id]);

  useEffect(() => {
    void loadLinkedParents();
  }, [loadLinkedParents]);

  const refreshParentCandidatesInModal = useCallback(async () => {
    if (!student?.id) return;
    setCandidatesLoading(true);
    try {
      const [all, linked] = await Promise.all([
        studentsApi.getParentCandidates(),
        studentsApi.getStudentParents(student.id),
      ]);
      setLinkedParents(linked);
      const linkedIds = new Set(linked.map((p) => p.parentId));
      setParentCandidates(all.filter((c) => !linkedIds.has(c.parentId)));
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as ApiError).message)
          : 'Veli adayları yüklenemedi.';
      showToast(msg, 'danger');
      setParentCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }, [student?.id, showToast]);

  const openAddParentModal = async () => {
    if (!student?.id) return;
    setAddParentModalOpen(true);
    setSelectedParentId('');
    setNewParentEmail('');
    setNewParentPassword('');
    setNewParentDisplayName('');
    setNewParentPhone('');
    await refreshParentCandidatesInModal();
  };

  if (!student) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-person-x fs-1 text-muted d-block mb-3" />
        <h5>Öğrenci bulunamadı</h5>
        <Link to="/dashboard/ogrenci-takibi">
          <Button variant="outline-primary">Öğrenci listesine dön</Button>
        </Link>
      </div>
    );
  }

  const cls = student.classId ? getClassById(student.classId) : null;
  const detailTab = searchParams.get('sekme') === 'bilgiler' ? 'bilgiler' : 'performans';

  const setDetailTab = (tab: 'performans' | 'bilgiler') => {
    setSearchParams({ sekme: tab }, { replace: true });
  };

  return (
    <div className="pb-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start mb-4 mb-lg-5 gap-3">
        <div className="min-w-0 w-100">
          <Link
            to="/dashboard/ogrenci-takibi"
            className="text-decoration-none text-muted small d-inline-flex align-items-center mb-2"
          >
            <i className="bi bi-arrow-left me-1" aria-hidden /> Öğrenci Takibine Dön
          </Link>
          <div className="d-flex align-items-center">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold fs-3 me-3 shadow-sm flex-shrink-0"
              style={{ width: '50px', height: '50px' }}
              aria-hidden
            >
              {(student.firstName?.[0] || '').toUpperCase()}
              {(student.lastName?.[0] || '').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="fw-bold mb-0 text-dark text-break">
                {student.firstName} {student.lastName}
              </h2>
              <div className="text-muted fs-6 mb-1">No: {student.studentNo}</div>
              {cls && (
                <Badge bg="primary" className="fw-normal">
                  {cls.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="d-flex flex-wrap gap-2 mb-4 mb-lg-5"
        role="tablist"
        aria-label="Öğrenci görünümü"
      >
        <Button
          type="button"
          variant={detailTab === 'performans' ? 'primary' : 'outline-primary'}
          className="d-inline-flex align-items-center"
          onClick={() => setDetailTab('performans')}
          aria-pressed={detailTab === 'performans'}
          id="student-tab-performans"
          aria-controls="student-panel-performans"
        >
          <i className="bi bi-speedometer2 me-2" aria-hidden />
          Performans
        </Button>
        <Button
          type="button"
          variant={detailTab === 'bilgiler' ? 'primary' : 'outline-primary'}
          className="d-inline-flex align-items-center"
          onClick={() => setDetailTab('bilgiler')}
          aria-pressed={detailTab === 'bilgiler'}
          id="student-tab-bilgiler"
          aria-controls="student-panel-bilgiler"
        >
          <i className="bi bi-person-vcard me-2" aria-hidden />
          Bilgiler
        </Button>
      </div>

      {detailTab === 'performans' ? (
        <div
          id="student-panel-performans"
          role="tabpanel"
          aria-labelledby="student-tab-performans"
        >
          <StudentPerformanceInsightsPanel results={performanceInsightsResults} className="mb-5" />

          <Row className="g-4">
            {examOptionsForStudent.length > 0 && (
              <Col xs={12}>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-white border-bottom py-3">
                    <div className="d-flex flex-column flex-lg-row flex-lg-wrap align-items-lg-start justify-content-lg-between gap-3">
                      <div className="flex-grow-1">
                        <h6 className="fw-semibold mb-0">
                          <i className="bi bi-exclamation-triangle me-2" />
                          Konu bazlı hata özeti
                        </h6>
                        <p className="text-muted small mb-0 mt-2">
                          {topicSummaryExamFilter ? (
                            <>
                              Yalnızca seçtiğiniz sınavdaki yanlışlar listelenir. Farklı denemeleri tek
                              tek incelemek için sınavı değiştirin veya &quot;Tüm sınavlar&quot; ile birleşik
                              görünüme dönün.
                            </>
                          ) : (
                            <>
                              Tüm sınavlar birleştirilmiştir. &quot;Kaç sınavda&quot;, ilgili konuda hata
                              görülen farklı sınav sayısıdır. Tek deneme görmek için sınav seçin.
                            </>
                          )}
                        </p>
                        {topicSummaryExamLabel && (
                          <Badge bg="info" className="mt-2 fw-normal">
                            Seçili: {topicSummaryExamLabel}
                          </Badge>
                        )}
                      </div>
                      <Form.Group className="mb-0" style={{ minWidth: 'min(100%, 280px)' }}>
                        <Form.Label htmlFor="topic-summary-exam-filter" className="small fw-medium">
                          Sınav filtresi
                        </Form.Label>
                        <Form.Select
                          id="topic-summary-exam-filter"
                          value={topicSummaryExamFilter}
                          onChange={(e) => setTopicSummaryExamFilter(e.target.value)}
                          aria-label="Konu özetinde gösterilecek sınav"
                        >
                          <option value="">Tüm sınavlar (birleşik)</option>
                          {examOptionsForStudent.map((o) => (
                            <option key={o.examId} value={o.examId}>
                              {o.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </div>
                  </Card.Header>
                  <Card.Body className="p-0">
                    {topicSummary.length === 0 ? (
                      <Alert variant="light" className="border-0 rounded-0 mb-0 small text-muted">
                        {topicSummaryExamFilter
                          ? 'Bu sınavda konu bazlı yanlış kaydı yok (tümü doğru olabilir veya özet veri eksik).'
                          : 'Henüz konu bazlı yanlış özeti oluşmadı.'}
                      </Alert>
                    ) : (
                      <Table responsive hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Konu</th>
                            <th className="text-end">Toplam yanlış</th>
                            {!topicSummaryExamFilter && (
                              <>
                                <th className="text-end">Kaç sınavda</th>
                                <th>Son kayıt</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {topicSummary.map((t) => (
                            <tr key={t.topic}>
                              <td className="fw-medium">{t.topic}</td>
                              <td className="text-end">
                                <Badge bg="danger" className="fw-normal">
                                  {t.wrongCount}
                                </Badge>
                              </td>
                              {!topicSummaryExamFilter && (
                                <>
                                  <td className="text-end text-muted">{t.examOccurrences}</td>
                                  <td className="small text-muted">{t.lastExamSummary}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}

            {weeklyChartData.length > 0 && (
              <Col xs={12}>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-white border-bottom py-3">
                    <h6 className="fw-semibold mb-0">
                      <i className="bi bi-bar-chart-line me-2" />
                      Sınav bazında doğru ve yanlış
                    </h6>
                    <p className="text-muted small mb-0 mt-2">
                      Her sütun grubu bir sınavı temsil eder (tarih sırasıyla). Yeşil çubuk doğru, kırmızı
                      çubuk yanlış soru sayısıdır; sınavlar arası karşılaştırma çizgi grafikten daha
                      okunaklıdır.
                    </p>
                    {weeklyChartData.length === 1 && (
                      <Alert variant="light" className="border mt-3 mb-0 py-2 small text-muted">
                        Tek sınav sonucu görünüyor; yeni denemeler eklendikçe sütunlar çoğalır.
                      </Alert>
                    )}
                  </Card.Header>
                  <Card.Body>
                    <div className="w-100" style={{ minWidth: 0 }}>
                      <ResponsiveContainer
                        width="100%"
                        height={examPerformanceChartHeight}
                        debounce={32}
                      >
                        <BarChart
                          data={weeklyChartData}
                          margin={{ top: 8, right: 12, left: 4, bottom: 64 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="barAxisLabel"
                            tick={{ fontSize: 10 }}
                            tickMargin={6}
                            interval={0}
                            angle={-32}
                            textAnchor="end"
                            height={78}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            allowDecimals={false}
                            width={40}
                            label={{
                              value: 'Soru sayısı',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 11, fill: 'var(--bs-secondary-color)' },
                            }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0]?.payload as (typeof weeklyChartData)[number];
                              return (
                                <div className="rounded border bg-body p-2 shadow-sm small">
                                  <div className="fw-semibold">{p.examTitle}</div>
                                  <div className="text-muted mb-1">{p.week}</div>
                                  <div>
                                    Doğru: <strong className="text-success">{p.dogru}</strong> ·
                                    Yanlış: <strong className="text-danger">{p.yanlis}</strong> · Toplam:{' '}
                                    {p.toplamSoru}
                                  </div>
                                  <div className="text-muted">
                                    Başarı: %{p.basariPct} · Net (LGS): {p.net}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            align="center"
                            wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
                          />
                          <Bar
                            dataKey="dogru"
                            name="Doğru"
                            fill="var(--bs-success)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                          />
                          <Bar
                            dataKey="yanlis"
                            name="Yanlış"
                            fill="var(--bs-danger)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>
        </div>
      ) : (
        <div
          id="student-panel-bilgiler"
          role="tabpanel"
          aria-labelledby="student-tab-bilgiler"
        >
          <Row className="g-4">
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100" key={student.id}>
            <Card.Header className="bg-white border-bottom py-3">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-person-vcard me-2" />
                Öğrenci Bilgileri
              </h6>
            </Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="student-class" className="small text-muted">
                  Sınıf
                </Form.Label>
                <Form.Select
                  id="student-class"
                  value={student.classId ?? ''}
                  onChange={async (e) => {
                    try {
                      await assignStudentToClass(student.id, e.target.value || null);
                      showToast('Sınıf ataması yapıldı.');
                    } catch {
                      showToast('Sınıf ataması yapılırken bir hata oluştu.', 'danger');
                    }
                  }}
                  aria-label="Öğrenci sınıfı"
                >
                  <option value="">Sınıf atanmamış</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade}. sınıf)
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="student-email" className="small text-muted">
                  E-posta
                </Form.Label>
                <Form.Control
                  id="student-email"
                  type="email"
                  defaultValue={student.email ?? ''}
                  onBlur={async (e) => {
                    const val = e.target.value.trim() || undefined;
                    if (val === (student.email ?? undefined)) return;
                    try {
                      await updateStudent(student.id, { email: val });
                      showToast('Öğrenci güncellendi.');
                    } catch {
                      showToast('Güncelleme sırasında bir hata oluştu.', 'danger');
                    }
                  }}
                  placeholder="ornek@email.com"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="student-phone" className="small text-muted">
                  Telefon
                </Form.Label>
                <Form.Control
                  id="student-phone"
                  defaultValue={student.phone ?? ''}
                  onBlur={async (e) => {
                    const val = e.target.value.trim() || undefined;
                    if (val === (student.phone ?? undefined)) return;
                    try {
                      await updateStudent(student.id, { phone: val });
                      showToast('Öğrenci güncellendi.');
                    } catch {
                      showToast('Güncelleme sırasında bir hata oluştu.', 'danger');
                    }
                  }}
                  placeholder="05XX XXX XX XX"
                />
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="student-notes" className="small text-muted">
                  Notlar
                </Form.Label>
                <Form.Control
                  id="student-notes"
                  as="textarea"
                  rows={3}
                  defaultValue={student.notes ?? ''}
                  onBlur={async (e) => {
                    const val = e.target.value.trim() || undefined;
                    if (val === (student.notes ?? undefined)) return;
                    try {
                      await updateStudent(student.id, { notes: val });
                      showToast('Öğrenci güncellendi.');
                    } catch {
                      showToast('Güncelleme sırasında bir hata oluştu.', 'danger');
                    }
                  }}
                  placeholder="Öğrenci hakkında notlar..."
                />
              </Form.Group>
              <hr className="my-3" />
              <div className="d-flex align-items-center gap-2 mb-2">
                <h6 className="fw-semibold mb-0 small">Mobil uygulama</h6>
                {student.hasAppAccount ? (
                  <Badge bg="success">Giriş aktif</Badge>
                ) : (
                  <Badge bg="secondary">Hesap yok</Badge>
                )}
              </div>
              <p className="small text-muted mb-2">
                Öğrenci mobilde aynı e-posta ve burada belirlediğiniz şifre ile giriş yapar (en az 6 karakter).
              </p>
              <Form.Group className="mb-2">
                <Form.Label htmlFor="student-mobile-password" className="small text-muted">
                  {student.hasAppAccount ? 'Yeni şifre' : 'Şifre belirle'}
                </Form.Label>
                <Form.Control
                  id="student-mobile-password"
                  type="password"
                  value={mobilePassword}
                  onChange={(e) => setMobilePassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  autoComplete="new-password"
                  aria-label="Mobil uygulama şifresi"
                />
              </Form.Group>
              <Button
                variant="outline-primary"
                size="sm"
                disabled={mobilePassword.trim().length < 6 || !student.email?.trim()}
                onClick={async () => {
                  const pwd = mobilePassword.trim();
                  if (pwd.length < 6) return;
                  if (!student.email?.trim()) {
                    showToast('Önce e-posta girin.', 'danger');
                    return;
                  }
                  try {
                    await updateStudent(student.id, { initialPassword: pwd });
                    setMobilePassword('');
                    showToast(
                      student.hasAppAccount ? 'Şifre güncellendi.' : 'Mobil giriş etkinleştirildi.'
                    );
                  } catch (err) {
                    const msg =
                      err && typeof err === 'object' && 'message' in err
                        ? String((err as ApiError).message)
                        : 'İşlem başarısız.';
                    showToast(msg, 'danger');
                  }
                }}
              >
                Şifreyi kaydet
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom py-3">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-clipboard-check me-2" />
                Sınav Sonuçları
              </h6>
            </Card.Header>
            <Card.Body>
              {studentResults.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-file-earmark-text fs-2 d-block mb-2" />
                  <p className="mb-0 small">Henüz sınav sonucu yok</p>
                  <p className="small mb-0">Optik okuma sonuçları burada görünecektir.</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {studentResults.map((r) => {
                    const exam = exams.find((e) => e.id === r.examId);
                    return (
                      <div
                        key={r.id}
                        className="d-flex justify-content-between align-items-center gap-2 flex-wrap p-2 rounded bg-light"
                      >
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-medium small">{exam?.title ?? 'Sınav'}</div>
                          <div className="text-muted small">
                            {exam?.weekLabel ?? ''} · {r.correctCount} doğru / {r.wrongCount} yanlış
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-1 flex-shrink-0">
                          <Badge
                            bg={
                              r.wrongCount > 5 ? 'danger' : r.wrongCount > 2 ? 'warning' : 'success'
                            }
                          >
                            {r.correctCount + r.wrongCount} soru
                          </Badge>
                          {(r.suspiciousQuestions?.length ?? 0) > 0 && !r.suspiciousReviewedAt && (
                            <Button
                              variant="outline-warning"
                              size="sm"
                              className="px-2"
                              title="Şüpheli okuma — incele"
                              onClick={() => setSuspiciousTarget(r)}
                            >
                              <i className="bi bi-exclamation-triangle" aria-hidden />
                            </Button>
                          )}
                          {(r.suspiciousQuestions?.length ?? 0) > 0 && r.suspiciousReviewedAt && (
                            <Badge bg="secondary" className="small">
                              İncelendi
                            </Badge>
                          )}
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="px-2"
                            aria-label={`${exam?.title ?? 'Sınav'} sonucunu düzenle`}
                            onClick={() => {
                              setEditTarget(r);
                              setEditCorrect(r.correctCount);
                              setEditWrong(r.wrongCount);
                              setEditKeepTopics(false);
                            }}
                          >
                            <i className="bi bi-pencil" aria-hidden />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="px-2"
                            aria-label={`${exam?.title ?? 'Sınav'} sonucunu sil`}
                            onClick={() => setDeleteTargetId(r.id)}
                          >
                            <i className="bi bi-trash" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-people me-2" />
                Bağlı veliler
              </h6>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => void openAddParentModal()}
                disabled={parentActionLoading}
              >
                <i className="bi bi-person-plus me-1" />
                Veli ekle
              </Button>
            </Card.Header>
            <Card.Body>
              <p className="small text-muted mb-3">
                Veli hesabı olan kullanıcıları seçerek bağlayın. Veli, web panelinde bu öğrenciyi
                görebilir.
              </p>
              {parentsFetchError && (
                <Alert variant="warning" className="py-2 small mb-3">
                  {parentsFetchError}
                </Alert>
              )}
              {parentsLoading ? (
                <div className="text-muted small">Yükleniyor…</div>
              ) : linkedParents.length === 0 ? (
                <div className="text-muted small">Henüz bağlı veli yok.</div>
              ) : (
                <Table responsive size="sm" className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Ad</th>
                      <th>E-posta</th>
                      <th style={{ width: 100 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {linkedParents.map((p) => (
                      <tr key={p.parentId}>
                        <td className="fw-medium">{p.displayName}</td>
                        <td className="text-muted small">{p.email}</td>
                        <td className="text-end">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            disabled={parentActionLoading}
                            onClick={() => {
                              if (!window.confirm('Bu veli bağlantısını kaldırmak istiyor musunuz?')) {
                                return;
                              }
                              setParentActionLoading(true);
                              studentsApi
                                .unlinkStudentParent(student.id, p.parentId)
                                .then(() => {
                                  showToast('Veli bağlantısı kaldırıldı.');
                                  return loadLinkedParents();
                                })
                                .catch((err: unknown) => {
                                  const msg =
                                    err && typeof err === 'object' && 'message' in err
                                      ? String((err as ApiError).message)
                                      : 'Kaldırılamadı.';
                                  showToast(msg, 'danger');
                                })
                                .finally(() => setParentActionLoading(false));
                            }}
                          >
                            Kaldır
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
        </div>
      )}

      <Modal
        show={addParentModalOpen}
        onHide={() => !parentActionLoading && setAddParentModalOpen(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Veli bağla</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">
            Önce gerekirse yeni veli girişi oluşturun; ardından listeden seçip öğrenciye bağlayın.
            Veli, aynı e-posta ve şifre ile veli paneline giriş yapar.
          </p>

          <div className="border rounded p-3 mb-4 bg-body-secondary bg-opacity-25">
            <h6 className="small fw-semibold mb-3">
              <i className="bi bi-person-plus me-1" />
              Yeni veli hesabı
            </h6>
            <Form.Group className="mb-2">
              <Form.Label htmlFor="new-parent-email" className="small">
                E-posta
              </Form.Label>
              <Form.Control
                id="new-parent-email"
                type="email"
                autoComplete="off"
                value={newParentEmail}
                onChange={(e) => setNewParentEmail(e.target.value)}
                placeholder="veli@ornek.com"
                disabled={createParentLoading || parentActionLoading}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label htmlFor="new-parent-password" className="small">
                Şifre (en az 6 karakter)
              </Form.Label>
              <Form.Control
                id="new-parent-password"
                type="password"
                autoComplete="new-password"
                value={newParentPassword}
                onChange={(e) => setNewParentPassword(e.target.value)}
                disabled={createParentLoading || parentActionLoading}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label htmlFor="new-parent-name" className="small">
                Görünen ad
              </Form.Label>
              <Form.Control
                id="new-parent-name"
                type="text"
                value={newParentDisplayName}
                onChange={(e) => setNewParentDisplayName(e.target.value)}
                placeholder="Ayşe Yılmaz"
                disabled={createParentLoading || parentActionLoading}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="new-parent-phone" className="small">
                Telefon (isteğe bağlı)
              </Form.Label>
              <Form.Control
                id="new-parent-phone"
                type="tel"
                value={newParentPhone}
                onChange={(e) => setNewParentPhone(e.target.value)}
                disabled={createParentLoading || parentActionLoading}
              />
            </Form.Group>
            <Button
              variant="outline-primary"
              size="sm"
              disabled={
                createParentLoading ||
                parentActionLoading ||
                !newParentEmail.trim() ||
                newParentPassword.length < 6 ||
                !newParentDisplayName.trim()
              }
              onClick={() => {
                setCreateParentLoading(true);
                studentsApi
                  .createParentAccount({
                    email: newParentEmail,
                    password: newParentPassword,
                    displayName: newParentDisplayName,
                    phone: newParentPhone.trim() || null,
                  })
                  .then(async (created) => {
                    showToast('Veli hesabı oluşturuldu; listeden bağlayabilirsiniz.');
                    setSelectedParentId(created.parentId);
                    setNewParentPassword('');
                    await refreshParentCandidatesInModal();
                  })
                  .catch((err: unknown) => {
                    const msg =
                      err && typeof err === 'object' && 'message' in err
                        ? String((err as ApiError).message)
                        : 'Hesap oluşturulamadı.';
                    showToast(msg, 'danger');
                  })
                  .finally(() => setCreateParentLoading(false));
              }}
            >
              {createParentLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Oluşturuluyor…
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-1" />
                  Veli hesabı oluştur
                </>
              )}
            </Button>
          </div>

          <h6 className="small fw-semibold mb-2">Mevcut veli seç</h6>
          {candidatesLoading ? (
            <div className="d-flex justify-content-center py-3">
              <Spinner animation="border" size="sm" />
            </div>
          ) : parentCandidates.length === 0 ? (
            <p className="small text-muted mb-0">
              Bağlanabilecek başka veli yok. Yukarıdan yeni hesap oluşturun veya tüm veliler zaten
              bu öğrenciye eklenmiş olabilir.
            </p>
          ) : (
            <Form.Group>
              <Form.Label htmlFor="parent-candidate-select">Veli seçin</Form.Label>
              <Form.Select
                id="parent-candidate-select"
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                aria-label="Bağlanacak veli"
              >
                <option value="">Seçin…</option>
                {parentCandidates.map((c) => (
                  <option key={c.parentId} value={c.parentId}>
                    {c.displayName} ({c.email})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setAddParentModalOpen(false)}
            disabled={parentActionLoading}
          >
            Vazgeç
          </Button>
          <Button
            variant="primary"
            disabled={
              !selectedParentId ||
              parentActionLoading ||
              candidatesLoading ||
              createParentLoading
            }
            onClick={() => {
              if (!student || !selectedParentId) return;
              setParentActionLoading(true);
              studentsApi
                .linkStudentParent(student.id, selectedParentId)
                .then((list) => {
                  setLinkedParents(list);
                  showToast('Veli bağlandı.');
                  setAddParentModalOpen(false);
                })
                .catch((err: unknown) => {
                  const msg =
                    err && typeof err === 'object' && 'message' in err
                      ? String((err as ApiError).message)
                      : 'Bağlanamadı.';
                  showToast(msg, 'danger');
                })
                .finally(() => setParentActionLoading(false));
            }}
          >
            {parentActionLoading ? 'Kaydediliyor…' : 'Bağla'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={editTarget != null}
        onHide={() => !resultActionLoading && setEditTarget(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Sınav sonucunu düzenle</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editTarget && (
            <>
              <p className="text-muted small mb-3">
                {exams.find((e) => e.id === editTarget.examId)?.title ?? 'Sınav'}
              </p>
              <Alert variant="light" className="small border">
                Hatalı optik okuma gibi durumlarda doğru/yanlış sayılarını güncelleyin. Konu özeti
                kutusu kapalıyken mevcut konu dağılımı temizlenir; öğrenci gerekirse yeniden tarama
                yapabilir.
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="edit-correct-count">Doğru sayısı</Form.Label>
                <Form.Control
                  id="edit-correct-count"
                  type="number"
                  min={0}
                  value={editCorrect}
                  onChange={(e) =>
                    setEditCorrect(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="edit-wrong-count">Yanlış sayısı</Form.Label>
                <Form.Control
                  id="edit-wrong-count"
                  type="number"
                  min={0}
                  value={editWrong}
                  onChange={(e) =>
                    setEditWrong(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                  }
                />
              </Form.Group>
              <Form.Check
                type="checkbox"
                id="keep-wrong-topics"
                label="Mevcut konu özetini koru (yalnızca sayıları düzeltiyorsanız işaretleyin)"
                checked={editKeepTopics}
                onChange={(e) => setEditKeepTopics(e.target.checked)}
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setEditTarget(null)}
            disabled={resultActionLoading}
          >
            Vazgeç
          </Button>
          <Button
            variant="primary"
            disabled={resultActionLoading || !editTarget}
            onClick={async () => {
              if (!editTarget) return;
              setResultActionLoading(true);
              try {
                await updateExamResult(editTarget.id, {
                  correctCount: editCorrect,
                  wrongCount: editWrong,
                  wrongTopics: editKeepTopics ? editTarget.wrongTopics : [],
                });
                showToast('Sınav sonucu güncellendi.');
                setEditTarget(null);
              } catch (err) {
                const msg =
                  err && typeof err === 'object' && 'message' in err
                    ? String((err as ApiError).message)
                    : 'Kaydedilemedi.';
                showToast(msg, 'danger');
              } finally {
                setResultActionLoading(false);
              }
            }}
          >
            {resultActionLoading ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={suspiciousTarget != null}
        onHide={() => !resultActionLoading && setSuspiciousTarget(null)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Şüpheli okuma — soru incelemesi</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {suspiciousTarget && (
            <>
              <p className="text-muted small mb-3">
                {exams.find((e) => e.id === suspiciousTarget.examId)?.title ?? 'Sınav'} — aşağıdaki
                sorularda optik okuma güveni sınırda veya belirsiz olarak işaretlendi. Cevapları
                kontrol ettikten sonra incelemeyi onaylayabilirsiniz (puanları değiştirmez).
              </p>
              <Table responsive size="sm" bordered className="mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Soru</th>
                    <th>Güven</th>
                    <th>Durum</th>
                    <th>Not</th>
                  </tr>
                </thead>
                <tbody>
                  {(suspiciousTarget.suspiciousQuestions ?? []).map((s) => (
                    <tr key={s.questionIndex}>
                      <td className="fw-medium">{s.questionIndex}</td>
                      <td>{(s.confidence * 100).toFixed(1)}%</td>
                      <td>{s.status ?? '—'}</td>
                      <td>{s.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setSuspiciousTarget(null)}
            disabled={resultActionLoading}
          >
            Kapat
          </Button>
          <Button
            variant="primary"
            disabled={resultActionLoading || !suspiciousTarget}
            onClick={async () => {
              if (!suspiciousTarget) return;
              setResultActionLoading(true);
              try {
                await updateExamResult(suspiciousTarget.id, { acknowledgeSuspiciousReview: true });
                showToast('İnceleme kaydedildi.');
                setSuspiciousTarget(null);
              } catch (err) {
                const msg =
                  err && typeof err === 'object' && 'message' in err
                    ? String((err as ApiError).message)
                    : 'Kaydedilemedi.';
                showToast(msg, 'danger');
              } finally {
                setResultActionLoading(false);
              }
            }}
          >
            {resultActionLoading ? 'Kaydediliyor…' : 'İncelemeyi onayla'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={deleteTargetId != null}
        onHide={() => !resultActionLoading && setDeleteTargetId(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Sınav sonucunu sil</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Bu sonuç kalıcı olarak silinir. Öğrenci aynı sınav için tekrar optik gönderebilir. Emin
          misiniz?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeleteTargetId(null)}
            disabled={resultActionLoading}
          >
            Vazgeç
          </Button>
          <Button
            variant="danger"
            disabled={resultActionLoading}
            onClick={async () => {
              if (!deleteTargetId) return;
              setResultActionLoading(true);
              try {
                await deleteExamResult(deleteTargetId);
                showToast('Sınav sonucu silindi.');
                setDeleteTargetId(null);
              } catch (err) {
                const msg =
                  err && typeof err === 'object' && 'message' in err
                    ? String((err as ApiError).message)
                    : 'Silinemedi.';
                showToast(msg, 'danger');
              } finally {
                setResultActionLoading(false);
              }
            }}
          >
            {resultActionLoading ? 'Siliniyor…' : 'Sil'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
