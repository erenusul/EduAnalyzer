/**
 * Sınıf analiz ekranı - konu bazlı yanlış sayıları
 */

import { useMemo, useState } from 'react';
import { Card, Form, Table, Badge } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTeacherData } from '../contexts/TeacherDataContext';

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

export function ClassAnalysis() {
  const { classes, exams, examResults, getStudentsByClass, getStudentById } = useTeacherData();
  const readyExams = useMemo(() => exams.filter((e) => e.status === 'ready'), [exams]);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
  const [selectedExamId, setSelectedExamId] = useState<string>(readyExams[0]?.id ?? '');

  const classResults = useMemo(() => {
    if (!selectedClassId || !selectedExamId) return [];
    const classStudents = getStudentsByClass(selectedClassId);
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    return examResults.filter(
      (r) => r.examId === selectedExamId && classStudentIds.has(r.studentId)
    );
  }, [selectedClassId, selectedExamId, examResults, getStudentsByClass]);

  const topicStats = useMemo((): TopicStats[] => {
    if (classResults.length === 0) return [];

    const topicMap = new Map<string, { count: number; studentIds: Set<string> }>();

    for (const result of classResults) {
      for (const wt of result.wrongTopics ?? []) {
        const label =
          wt?.topic != null && String(wt.topic).trim() !== '' ? String(wt.topic).trim() : 'Bilinmiyor';
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
  }, [classResults, getStudentById]);

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

  const maxWrong = useMemo(
    () => (topicStats.length > 0 ? Math.max(...topicStats.map((t) => t.totalWrong)) : 0),
    [topicStats]
  );

  const chartData = useMemo(
    () =>
      topicStats.slice(0, 10).map((t) => {
        const topic = t.topic || 'Bilinmiyor';
        return {
          name: topic.length > 20 ? topic.substring(0, 20) + '...' : topic,
          fullName: topic,
          yanlis: t.totalWrong,
        };
      }),
    [topicStats]
  );

  const wrongQChartData = useMemo(
    () =>
      wrongQuestionFreq.map((w) => ({
        name: w.soruLabel.length > 6 ? w.soruLabel.slice(0, 6) + '…' : w.soruLabel,
        fullLabel: `Soru ${w.soruNo}`,
        adet: w.adet,
      })),
    [wrongQuestionFreq]
  );

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Sınıf Analizi</h4>
        <p className="text-muted mb-0">
          Sınıf ve sınav seçerek konu bazlı yanlış analizlerini görüntüleyin.
        </p>
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
                        formatter={(value: number | undefined) => [value ?? 0, 'Yanlış sayısı']}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullLabel ?? String(payload?.[0]?.payload?.name ?? '')
                        }
                      />
                      <Bar dataKey="adet" fill="var(--bs-danger)" name="Yanlış" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          )}

          {topicStats.length > 0 && (
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

          {topicStats.length > 0 ? (
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
                    {topicStats.map((t) => (
                      <tr key={t.topic}>
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
