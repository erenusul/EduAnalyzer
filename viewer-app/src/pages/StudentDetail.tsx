/**
 * Öğrenci detay sayfası - bilgiler, sınav sonuçları, konu hataları, haftalık grafik
 */

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Form, Button, Badge, Row, Col, Table, Modal, Alert } from 'react-bootstrap';
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
import type { ApiError } from '../services/apiClient';
import type { ExamResult } from '../types/teacher';

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
  const [resultActionLoading, setResultActionLoading] = useState(false);

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
      for (const wt of result.wrongTopics ?? []) {
        const label =
          wt?.topic != null && String(wt.topic).trim() !== '' ? String(wt.topic).trim() : 'Bilinmiyor';
        const n = typeof wt?.count === 'number' && Number.isFinite(wt.count) ? wt.count : 0;
        const existing = map.get(label);
        if (existing) {
          existing.count += n;
          if (week && (!existing.lastExamWeek || week > existing.lastExamWeek)) {
            existing.lastExamWeek = week;
          }
        } else {
          map.set(label, { count: n, lastExamWeek: week });
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
                <div className="w-100" style={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height={250} debounce={32}>
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
