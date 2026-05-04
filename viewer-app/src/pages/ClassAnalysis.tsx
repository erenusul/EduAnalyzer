/**
 * Sınıf analiz ekranı - konu bazlı yanlış sayıları
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, Form, Table, Badge, Button, Alert, Accordion } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTeacherData } from '../contexts/TeacherDataContext';
import type { ExamResult } from '../types/teacher';
import {
  buildExamQuestionTopicMap,
  resolveWrongQuestionTopicLabel,
} from '../utils/examQuestionTopics';

interface TopicStats {
  topic: string;
  studentCount: number;
  totalWrong: number;
  studentNames: string[];
}

interface StudentRankRow {
  studentId: string;
  name: string;
  dogru: number;
  yanlis: number;
  total: number;
  pct: number;
  net: number;
}

interface WrongAnswerDetailRow {
  questionIndex: number;
  studentId: string;
  studentName: string;
  studentAnswer: string;
  expectedAnswer: string;
  topic: string;
}

interface WrongAnswersQuestionGroup {
  questionIndex: number;
  topic: string;
  expectedAnswer: string;
  rows: WrongAnswerDetailRow[];
  choiceSummary: string;
}

function buildWrongChoiceSummary(rows: WrongAnswerDetailRow[]): string {
  const tallies = new Map<string, number>();
  for (const r of rows) {
    const k = r.studentAnswer === '—' ? '?' : r.studentAnswer;
    tallies.set(k, (tallies.get(k) ?? 0) + 1);
  }
  return Array.from(tallies.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
    .map(([k, n]) => `${k}×${n}`)
    .join(', ');
}

function groupWrongAnswersByQuestion(details: WrongAnswerDetailRow[]): WrongAnswersQuestionGroup[] {
  const byQuestion = new Map<number, WrongAnswerDetailRow[]>();
  for (const r of details) {
    const list = byQuestion.get(r.questionIndex) ?? [];
    list.push(r);
    byQuestion.set(r.questionIndex, list);
  }
  return Array.from(byQuestion.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([questionIndex, rows]) => {
      const sortedRows = [...rows].sort((a, b) =>
        a.studentName.localeCompare(b.studentName, 'tr')
      );
      const topic = sortedRows[0]?.topic ?? '—';
      const expectedAnswer = sortedRows[0]?.expectedAnswer ?? '—';
      return {
        questionIndex,
        topic,
        expectedAnswer,
        rows: sortedRows,
        choiceSummary: buildWrongChoiceSummary(sortedRows),
      };
    });
}

function aggregateTopicStatsFromResults(
  results: ExamResult[],
  examTopicByQuestion: Map<number, string>,
  getStudentById: (id: string) => { firstName: string; lastName: string } | undefined
): TopicStats[] {
  const topicMap = new Map<string, { count: number; studentIds: Set<string> }>();

  for (const result of results) {
    const wqList = result.wrongQuestions ?? [];

    if (wqList.length > 0) {
      for (const w of wqList) {
        const label = resolveWrongQuestionTopicLabel(w.questionIndex, w.topic, examTopicByQuestion);
        const existing = topicMap.get(label);
        if (existing) {
          existing.count += 1;
          existing.studentIds.add(result.studentId);
        } else {
          topicMap.set(label, {
            count: 1,
            studentIds: new Set([result.studentId]),
          });
        }
      }
      continue;
    }

    for (const wt of result.wrongTopics ?? []) {
      const label =
        wt?.topic != null && String(wt.topic).trim() !== ''
          ? String(wt.topic).trim()
          : 'Bilinmiyor';
      const n = typeof wt?.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
      const existing = topicMap.get(label);
      if (existing) {
        existing.count += n;
        existing.studentIds.add(result.studentId);
      } else {
        topicMap.set(label, {
          count: n,
          studentIds: new Set([result.studentId]),
        });
      }
    }
  }

  return Array.from(topicMap.entries())
    .map(([topic, { count, studentIds }]) => ({
      topic,
      studentCount: studentIds.size,
      totalWrong: count,
      studentNames: Array.from(studentIds)
        .map((sid) => getStudentById(sid))
        .filter(Boolean)
        .map((s) => `${s!.firstName} ${s!.lastName}`),
    }))
    .sort((a, b) => b.totalWrong - a.totalWrong);
}

function buildWrongAnswerDetails(
  results: ExamResult[],
  examTopicByQuestion: Map<number, string>,
  getStudentById: (id: string) => { firstName: string; lastName: string } | undefined
): WrongAnswerDetailRow[] {
  const rows: WrongAnswerDetailRow[] = [];
  for (const result of results) {
    const name =
      (() => {
        const s = getStudentById(result.studentId);
        return s ? `${s.firstName} ${s.lastName}` : '—';
      })();
    for (const w of result.wrongQuestions ?? []) {
      const topic = resolveWrongQuestionTopicLabel(w.questionIndex, w.topic, examTopicByQuestion);
      const ans = (w.studentAnswer ?? '').trim().toUpperCase();
      const letter = ans.length > 0 ? ans.charAt(0) : '—';
      rows.push({
        questionIndex: w.questionIndex,
        studentId: result.studentId,
        studentName: name,
        studentAnswer: letter,
        expectedAnswer: w.expectedAnswer?.trim().toUpperCase() ?? '—',
        topic,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.questionIndex - b.questionIndex ||
      a.studentName.localeCompare(b.studentName, 'tr')
  );
}

export function ClassAnalysis() {
  const {
    classes,
    exams,
    analyses,
    examResults,
    getStudentsByClass,
    getStudentById,
    refresh,
    loading,
  } = useTeacherData();
  const readyExams = useMemo(() => exams.filter((e) => e.status === 'ready'), [exams]);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
  const [selectedExamId, setSelectedExamId] = useState<string>(readyExams[0]?.id ?? '');

  useEffect(() => {
    if (classes.length === 0) {
      setSelectedClassId('');
      return;
    }
    setSelectedClassId((prev) => {
      if (prev && classes.some((c) => c.id === prev)) return prev;
      return classes[0]!.id;
    });
  }, [classes]);

  useEffect(() => {
    if (readyExams.length === 0) {
      setSelectedExamId('');
      return;
    }
    setSelectedExamId((prev) => {
      if (prev && readyExams.some((e) => e.id === prev)) return prev;
      return readyExams[0]!.id;
    });
  }, [readyExams]);

  const classResults = useMemo(() => {
    if (!selectedClassId || !selectedExamId) return [];
    const classStudents = getStudentsByClass(selectedClassId);
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    return examResults.filter(
      (r) => r.examId === selectedExamId && classStudentIds.has(r.studentId)
    );
  }, [selectedClassId, selectedExamId, examResults, getStudentsByClass]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const analysisForExam = useMemo(
    () => analyses.find((a) => a.id === selectedExam?.analysisId),
    [analyses, selectedExam?.analysisId]
  );

  const examTopicByQuestion = useMemo(
    () => buildExamQuestionTopicMap(analysisForExam, selectedExam),
    [analysisForExam, selectedExam]
  );

  const topicStats = useMemo((): TopicStats[] => {
    if (classResults.length === 0) return [];
    return aggregateTopicStatsFromResults(classResults, examTopicByQuestion, getStudentById);
  }, [classResults, examTopicByQuestion, getStudentById]);

  const wrongAnswerDetails = useMemo(
    () => buildWrongAnswerDetails(classResults, examTopicByQuestion, getStudentById),
    [classResults, examTopicByQuestion, getStudentById]
  );

  const wrongAnswerGroups = useMemo(
    () => groupWrongAnswersByQuestion(wrongAnswerDetails),
    [wrongAnswerDetails]
  );

  const defaultWrongAnswersAccordionKey = useMemo(() => {
    if (wrongAnswerGroups.length === 0) return undefined;
    let top = wrongAnswerGroups[0]!;
    for (const g of wrongAnswerGroups) {
      if (g.rows.length > top.rows.length) top = g;
    }
    return String(top.questionIndex);
  }, [wrongAnswerGroups]);

  const studentRanking = useMemo((): StudentRankRow[] => {
    return classResults
      .map((r) => {
        const s = getStudentById(r.studentId);
        const name = s ? `${s.firstName} ${s.lastName}` : '—';
        const total = r.correctCount + r.wrongCount;
        const pct = total > 0 ? Math.round((r.correctCount / total) * 1000) / 10 : 0;
        const net = Math.round((r.correctCount - r.wrongCount / 4) * 10) / 10;
        return {
          studentId: r.studentId,
          name,
          dogru: r.correctCount,
          yanlis: r.wrongCount,
          total,
          pct,
          net,
        };
      })
      .sort((a, b) => b.pct - a.pct || b.net - a.net || a.name.localeCompare(b.name, 'tr'));
  }, [classResults, getStudentById]);

  const classAveragePct = useMemo(() => {
    if (studentRanking.length === 0) return null;
    const sum = studentRanking.reduce((acc, x) => acc + x.pct, 0);
    return Math.round((sum / studentRanking.length) * 10) / 10;
  }, [studentRanking]);

  const wrongQuestionFreq = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of classResults) {
      for (const w of r.wrongQuestions ?? []) {
        map.set(w.questionIndex, (map.get(w.questionIndex) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([soruNo, adet]) => ({
        soruLabel: `${soruNo}`,
        soruNo,
        adet,
      }))
      .sort((a, b) => b.adet - a.adet)
      .slice(0, 18);
  }, [classResults]);

  const topicStatsPositive = useMemo(
    () => topicStats.filter((t) => t.totalWrong > 0),
    [topicStats]
  );

  const maxWrong = useMemo(
    () =>
      topicStatsPositive.length > 0
        ? Math.max(...topicStatsPositive.map((t) => t.totalWrong))
        : 0,
    [topicStatsPositive]
  );

  const chartData = useMemo(
    () =>
      topicStatsPositive.slice(0, 10).map((t) => {
        const topic = t.topic || 'Bilinmiyor';
        return {
          name: topic.length > 20 ? topic.substring(0, 20) + '...' : topic,
          fullName: topic,
          yanlis: t.totalWrong,
        };
      }),
    [topicStatsPositive]
  );

  const hasWrongQuestionBreakdown = useMemo(
    () => classResults.some((r) => (r.wrongQuestions?.length ?? 0) > 0),
    [classResults]
  );

  const wrongQChartData = useMemo(
    () =>
      wrongQuestionFreq.map((w) => {
        const topicLine = examTopicByQuestion.get(w.soruNo) ?? 'Bilinmiyor';
        return {
          name: w.soruLabel.length > 6 ? w.soruLabel.slice(0, 6) + '…' : w.soruLabel,
          fullLabel: `Soru ${w.soruNo}`,
          adet: w.adet,
          topicLine,
        };
      }),
    [wrongQuestionFreq, examTopicByQuestion]
  );

  return (
    <div>
      <div className="mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2">
        <div>
          <h4 className="fw-bold mb-1">Sınıf Analizi</h4>
          <p className="text-muted mb-0">
            Sınıf ve sınav seçerek konu bazlı yanlış analizlerini görüntüleyin.
          </p>
        </div>
        <Button
          variant="outline-primary"
          size="sm"
          className="flex-shrink-0"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Sınıf ve sınav listesini sunucudan yenile"
        >
          <i className="bi bi-arrow-clockwise me-1" aria-hidden />
          Yenile
        </Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label htmlFor="class-analysis-class" className="fw-medium">
                  Sınıf
                </Form.Label>
                <Form.Select
                  id="class-analysis-class"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  aria-label="Sınıf seçin"
                >
                  <option value="">Sınıf seçin</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade}. sınıf)
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label htmlFor="class-analysis-exam" className="fw-medium">
                  Sınav
                </Form.Label>
                <Form.Select
                  id="class-analysis-exam"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  aria-label="Sınav seçin"
                >
                  <option value="">Sınav seçin</option>
                  {readyExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.weekLabel})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          </div>
        </Card.Body>
      </Card>

      {!selectedClassId || !selectedExamId ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-bar-chart fs-1 d-block mb-2" />
            <p className="mb-0">Sınıf ve sınav seçerek analiz başlatın.</p>
          </Card.Body>
        </Card>
      ) : classResults.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2" />
            <p className="mb-0">Bu sınav için henüz kayıtlı sonuç yok.</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-bottom py-3">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-people me-2" />
                Öğrenci karşılaştırması (aynı sınav)
              </h6>
              {classAveragePct != null && (
                <p className="text-muted small mb-0 mt-2">
                  Sınıf ortalama başarı:{' '}
                  <strong className="text-primary">{classAveragePct}%</strong> · Kayıt sayısı:{' '}
                  {studentRanking.length}
                </p>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 56 }}>#</th>
                    <th>Öğrenci</th>
                    <th>Doğru</th>
                    <th>Yanlış</th>
                    <th>Başarı %</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRanking.map((row, idx) => (
                    <tr key={row.studentId}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="fw-medium">{row.name}</td>
                      <td>{row.dogru}</td>
                      <td>{row.yanlis}</td>
                      <td>
                        <Badge bg={row.pct >= 70 ? 'success' : row.pct >= 50 ? 'warning' : 'danger'}>
                          {row.pct}%
                        </Badge>
                      </td>
                      <td>{row.net}</td>
                    </tr>
                  ))}
                  {classAveragePct != null && (
                    <tr className="table-light fw-semibold">
                      <td />
                      <td>Ortalama</td>
                      <td colSpan={2} className="text-muted small fw-normal">
                        —
                      </td>
                      <td>{classAveragePct}%</td>
                      <td className="text-muted small fw-normal">
                        —
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-bottom py-3">
              <h6 className="fw-semibold mb-0">
                <i className="bi bi-ui-checks-grid me-2" />
                Yanlış sorularda işaretlenen şıklar
              </h6>
              <p className="text-muted small mb-0 mt-1">
                Sorular gruplanır; başlıkta özet, açılan bölümde öğrenci bazlı şıklar yer alır. Çok öğrencide
                listeyi daraltmak için yalnızca ilgili soruyu açın.
              </p>
            </Card.Header>
            <Card.Body className="p-0">
              {!hasWrongQuestionBreakdown ? (
                <Alert variant="light" className="border-0 rounded-0 mb-0 text-muted small">
                  Bu sonuç kayıtlarında soru bazlı şık listesi yok (ör. yalnızca özet girilmiş olabilir). Mobil
                  optik tarama veya öğretmen panelinden şık detaylı kayıt açıldığında tablo dolar.
                </Alert>
              ) : (
                <Accordion
                  defaultActiveKey={defaultWrongAnswersAccordionKey}
                  className="rounded-0 border-0"
                  flush
                >
                  {wrongAnswerGroups.map((g) => (
                    <Accordion.Item
                      eventKey={String(g.questionIndex)}
                      key={g.questionIndex}
                      className="border-start-0 border-end-0"
                    >
                      <Accordion.Header
                        aria-label={`Soru ${g.questionIndex}, ${g.rows.length} öğrenci yanlış, ayrıntıyı aç veya kapat`}
                      >
                        <div className="d-flex flex-column flex-lg-row flex-lg-wrap align-items-lg-center gap-1 gap-lg-2 w-100 text-start pe-2">
                          <span className="fw-semibold text-nowrap">Soru {g.questionIndex}</span>
                          <Badge bg="secondary" className="align-self-start">
                            {g.rows.length} öğrenci
                          </Badge>
                          <span className="text-muted small">
                            Konu: <span className="text-body">{g.topic}</span>
                          </span>
                          <span className="text-muted small">
                            Yanlış şık: <span className="text-body">{g.choiceSummary}</span>
                          </span>
                          <span className="text-muted small ms-lg-auto">
                            Doğru:{' '}
                            {g.expectedAnswer === '—' ? (
                              <span>—</span>
                            ) : (
                              <Badge bg="success" className="fw-normal">
                                {g.expectedAnswer}
                              </Badge>
                            )}
                          </span>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body className="p-0 bg-body-tertiary">
                        <Table responsive hover size="sm" className="mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Öğrenci</th>
                              <th>İşaretlenen</th>
                              <th>Doğru şık</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((row) => (
                              <tr key={`${row.studentId}-${row.questionIndex}`}>
                                <td className="fw-medium">{row.studentName}</td>
                                <td>
                                  {row.studentAnswer === '—' ? (
                                    <span className="text-muted">—</span>
                                  ) : (
                                    <Badge bg="danger">{row.studentAnswer}</Badge>
                                  )}
                                </td>
                                <td>
                                  {row.expectedAnswer === '—' ? (
                                    <span className="text-muted">—</span>
                                  ) : (
                                    <Badge bg="success">{row.expectedAnswer}</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </Card.Body>
          </Card>

          {wrongQChartData.length > 0 && (
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white border-bottom py-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-hash me-2" />
                  En çok yanlış yapılan sorular
                </h6>
                <p className="text-muted small mb-0 mt-1">
                  Seçili sınıfta bu sınavda yanlış işaretlenen soru numaralarına göre frekans.
                </p>
              </Card.Header>
              <Card.Body>
                <div className="w-100" style={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height={280} debounce={32}>
                    <BarChart data={wrongQChartData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(var(--bs-primary-rgb), 0.06)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as {
                            fullLabel?: string;
                            adet?: number;
                            topicLine?: string;
                          };
                          return (
                            <div className="rounded border bg-body p-2 shadow-sm small">
                              <div className="fw-semibold mb-1">{row.fullLabel ?? ''}</div>
                              <div className="text-muted mb-1">Konu: {row.topicLine ?? '—'}</div>
                              <div>Yanlış sayısı: {row.adet ?? 0}</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="adet" fill="var(--bs-danger)" name="Yanlış" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          )}

          {chartData.length > 0 && (
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white border-bottom py-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-bar-chart me-2" />
                  Konu Bazlı Yanlış Dağılımı
                  {selectedExam && (
                    <Badge bg="info" className="ms-2">
                      {selectedExam.weekLabel}
                    </Badge>
                  )}
                </h6>
                <p className="text-muted small mb-0 mt-1">
                  Konular, bu sınavın bağlı olduğu PDF analizindeki soru tahminleriyle eşleştirilir; veri yoksa
                  anlamlı dağılım çıkmaz (hata değil, eksik analiz veya indeks uyumsuzluğu olabilir).
                </p>
              </Card.Header>
              <Card.Body>
                <div
                  className="w-100"
                  style={{ minWidth: 0 }}
                  role="img"
                  aria-label="Sınıf konu bazlı yanlış dağılımı grafiği"
                >
                  <ResponsiveContainer width="100%" height={300} debounce={32}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
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

          {topicStatsPositive.length > 0 ? (
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom py-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-table me-2" />
                  Konu Bazlı Detay
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Konu</th>
                      <th>Yanlış Yapan</th>
                      <th>Toplam Yanlış</th>
                      <th>Öğrenciler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicStatsPositive.map((t, idx) => (
                      <tr key={`${t.topic}-${idx}`}>
                        <td className="fw-medium">
                          {t.totalWrong === maxWrong && maxWrong > 0 && (
                            <Badge bg="danger" className="me-2">
                              En çok
                            </Badge>
                          )}
                          {t.topic}
                        </td>
                        <td>{t.studentCount}</td>
                        <td>{t.totalWrong}</td>
                        <td className="small text-muted">
                          {t.studentNames.slice(0, 3).join(', ')}
                          {t.studentNames.length > 3 && ` +${t.studentNames.length - 3}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm bg-body-tertiary">
              <Card.Body className="text-muted small py-3">
                Bu sınav için henüz yanlış konu kaydı yok (tümü doğru olabilir veya konu bilgisi yok).
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
