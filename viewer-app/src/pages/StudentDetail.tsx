/**
 * Öğrenci detay sayfası - bilgiler, sınav sonuçları, konu hataları, haftalık grafik
 */

import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Form, Button, Badge, Row, Col, Table } from 'react-bootstrap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';

export function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    getStudentById,
    getClassById,
    classes,
    updateStudent,
    assignStudentToClass,
    exams,
    getResultsByStudent,
  } = useTeacherData();
  const { showToast } = useToast();

  const student = id ? getStudentById(id) : null;

  const studentResults = useMemo(
    () => (student ? getResultsByStudent(student.id) : []),
    [student, getResultsByStudent]
  );

  const topicSummary = useMemo(() => {
    const map = new Map<string, { count: number; lastExamWeek: string }>();
    for (const result of studentResults) {
      const exam = exams.find((e) => e.id === result.examId);
      const week = exam?.weekLabel ?? '';
      for (const wt of result.wrongTopics) {
        const existing = map.get(wt.topic);
        if (existing) {
          existing.count += wt.count;
          if (week && (!existing.lastExamWeek || week > existing.lastExamWeek)) {
            existing.lastExamWeek = week;
          }
        } else {
          map.set(wt.topic, { count: wt.count, lastExamWeek: week });
        }
      }
    }
    return Array.from(map.entries())
      .map(([topic, { count, lastExamWeek }]) => ({ topic, count, lastExamWeek }))
      .sort((a, b) => b.count - a.count);
  }, [studentResults, exams]);

  const weeklyChartData = useMemo(() => {
    return studentResults
      .map((r) => {
        const exam = exams.find((e) => e.id === r.examId);
        return exam
          ? {
              week: exam.weekLabel,
              dogru: r.correctCount,
              yanlis: r.wrongCount,
              net: r.correctCount - r.wrongCount / 4,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.week.localeCompare(b!.week));
  }, [studentResults, exams]);

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

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/dashboard/ogrenci-takibi"
          className="text-decoration-none text-muted small mb-2 d-inline-block"
        >
          <i className="bi bi-arrow-left me-1" /> Öğrenci listesine dön
        </Link>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h4 className="fw-bold mb-1">
              {student.firstName} {student.lastName}
            </h4>
            <p className="text-muted mb-0">
              No: {student.studentNo}
              {cls && (
                <Badge bg="primary" className="ms-2">
                  {cls.name}
                </Badge>
              )}
            </p>
          </div>
        </div>
      </div>

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
                        className="d-flex justify-content-between align-items-center p-2 rounded bg-light"
                      >
                        <div>
                          <div className="fw-medium small">{exam?.title ?? 'Sınav'}</div>
                          <div className="text-muted small">
                            {exam?.weekLabel ?? ''} · {r.correctCount} doğru / {r.wrongCount} yanlış
                          </div>
                        </div>
                        <Badge
                          bg={
                            r.wrongCount > 5 ? 'danger' : r.wrongCount > 2 ? 'warning' : 'success'
                          }
                        >
                          {r.correctCount + r.wrongCount} soru
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {topicSummary.length > 0 && (
          <Col xs={12}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom py-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-exclamation-triangle me-2" />
                  Konu Bazlı Hata Özeti
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Konu</th>
                      <th>Yanlış Sayısı</th>
                      <th>Son Sınav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicSummary.map((t) => (
                      <tr key={t.topic}>
                        <td className="fw-medium">{t.topic}</td>
                        <td>{t.count}</td>
                        <td className="text-muted small">{t.lastExamWeek || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        )}

        {weeklyChartData.length > 0 && (
          <Col xs={12}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom py-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-graph-up me-2" />
                  Haftalık Gelişim
                </h6>
              </Card.Header>
              <Card.Body>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="dogru"
                        stroke="var(--bs-success)"
                        name="Doğru"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="yanlis"
                        stroke="var(--bs-danger)"
                        name="Yanlış"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
