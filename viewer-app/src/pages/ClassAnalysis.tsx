/**
 * Sınıf analiz ekranı - konu bazlı yanlış sayıları
 */

import { useMemo, useState } from 'react';
import { Card, Form, Table, Badge } from 'react-bootstrap';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTeacherData } from '../contexts/TeacherDataContext';

interface TopicStats {
  topic: string;
  studentCount: number;
  totalWrong: number;
  studentNames: string[];
}

export function ClassAnalysis() {
  const { classes, exams, examResults, getStudentsByClass, getStudentById } =
    useTeacherData();
  const readyExams = useMemo(() => exams.filter((e) => e.status === 'ready'), [exams]);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
  const [selectedExamId, setSelectedExamId] = useState<string>(readyExams[0]?.id ?? '');

  const topicStats = useMemo((): TopicStats[] => {
    if (!selectedClassId || !selectedExamId) return [];

    const classStudents = getStudentsByClass(selectedClassId);
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    const results = examResults.filter(
      (r) => r.examId === selectedExamId && classStudentIds.has(r.studentId)
    );

    const topicMap = new Map<string, { count: number; studentIds: Set<string> }>();

    for (const result of results) {
      for (const wt of result.wrongTopics) {
        const existing = topicMap.get(wt.topic);
        if (existing) {
          existing.count += wt.count;
          existing.studentIds.add(result.studentId);
        } else {
          topicMap.set(wt.topic, {
            count: wt.count,
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
  }, [
    selectedClassId,
    selectedExamId,
    examResults,
    getStudentsByClass,
    getStudentById,
  ]);

  const maxWrong = useMemo(
    () => (topicStats.length > 0 ? Math.max(...topicStats.map((t) => t.totalWrong)) : 0),
    [topicStats]
  );

  const chartData = useMemo(
    () =>
      topicStats.slice(0, 10).map((t) => ({
        name: t.topic.length > 20 ? t.topic.substring(0, 20) + '...' : t.topic,
        fullName: t.topic,
        yanlis: t.totalWrong,
      })),
    [topicStats]
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
                <Form.Label className="fw-medium">Sınıf</Form.Label>
                <Form.Select
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
                <Form.Label className="fw-medium">Sınav</Form.Label>
                <Form.Select
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
      ) : topicStats.length === 0 ? (
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
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
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
        </>
      )}
    </div>
  );
}
