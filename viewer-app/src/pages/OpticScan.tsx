/**
 * Optik tarama sayfası - sınav seç, öğrenci seç, cevap girişi, Scan API
 */

import { useState, useMemo } from 'react';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { examsApi, OPTICAL_TEMPLATE_LGS_SOZEL_CROP_117X107 } from '../services/backendApi';
import { useToast } from '../contexts/ToastContext';
import { CameraCapture } from '../components/CameraCapture';

const OPTIONS = ['A', 'B', 'C', 'D'];

function optionCountFromAnswerKey(answerKey: string[] | undefined): number {
  if (!answerKey?.length) return 4;
  return answerKey.some((a) => /^E$/i.test(String(a ?? '').trim())) ? 5 : 4;
}

export function OpticScan() {
  const { exams, students, refresh } = useTeacherData();
  const { showToast } = useToast();
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyExams = useMemo(
    () => exams.filter((e) => e.status === 'ready'),
    [exams]
  );

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId]
  );

  const questionCount = useMemo(() => {
    if (!selectedExam) return 0;
    const keyLen = selectedExam.answerKey?.length ?? 0;
    if (keyLen > 0) return keyLen;
    const resLen = Array.isArray(selectedExam.selectedResults)
      ? selectedExam.selectedResults.length
      : 0;
    return Math.max(resLen, 20);
  }, [selectedExam]);

  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    setSelectedStudentId('');
    setCapturedImage(null);
    const exam = exams.find((e) => e.id === examId);
    const keyLen = exam?.answerKey?.length ?? 0;
    const resLen = Array.isArray(exam?.selectedResults) ? exam.selectedResults.length : 0;
    const count = keyLen > 0 ? keyLen : Math.max(resLen, 20);
    setAnswers(Array(count).fill(''));
  };

  const handleCapture = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setCapturedImage(url);
    setCapturedBlob(blob);
  };

  const handleOcrAndSave = async () => {
    if (!selectedExamId || !selectedStudentId || !capturedBlob) {
      showToast('Sınav, öğrenci ve fotoğraf gerekli.', 'warning');
      return;
    }
    const exam = exams.find((e) => e.id === selectedExamId);
    if (!exam?.answerKey?.length) {
      showToast('Bu sınav için cevap anahtarı tanımlanmamış.', 'danger');
      return;
    }
    setOcrLoading(true);
    setError(null);
    try {
      await examsApi.scanImage(
        selectedExamId,
        selectedStudentId,
        capturedBlob,
        exam.answerKey.length,
        optionCountFromAnswerKey(exam.answerKey),
        OPTICAL_TEMPLATE_LGS_SOZEL_CROP_117X107
      );
      await refresh();
      showToast('Optik form OCR ile okundu ve kaydedildi.');
      if (capturedImage) URL.revokeObjectURL(capturedImage);
      setCapturedImage(null);
      setCapturedBlob(null);
      setSelectedStudentId('');
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'OCR sırasında hata oluştu.';
      setError(msg);
      showToast(msg, 'danger');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedExamId || !selectedStudentId) {
      showToast('Sınav ve öğrenci seçiniz.', 'warning');
      return;
    }
    const exam = exams.find((e) => e.id === selectedExamId);
    if (!exam?.answerKey?.length) {
      showToast('Bu sınav için cevap anahtarı tanımlanmamış.', 'danger');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const normalized = answers.slice(0, questionCount).map((a) => a.trim().toUpperCase() || '');
      await examsApi.scan(selectedExamId, selectedStudentId, normalized);
      await refresh();
      showToast('Optik tarama sonucu kaydedildi.');
      setAnswers(Array(questionCount).fill(''));
      setSelectedStudentId('');
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Tarama sırasında hata oluştu.';
      setError(msg);
      showToast(msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Optik Tarama</h4>
        <p className="text-muted mb-0">
          Sınav ve öğrenci seçerek optik form cevaplarını girin. Sonuç otomatik hesaplanır ve kaydedilir.
        </p>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white border-bottom py-3">
          <h6 className="fw-semibold mb-0">
            <i className="bi bi-sliders me-2" />
            Sınav ve Öğrenci Seçimi
          </h6>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label htmlFor="optic-exam">Sınav</Form.Label>
                <Form.Select
                  id="optic-exam"
                  value={selectedExamId}
                  onChange={(e) => handleExamChange(e.target.value)}
                  aria-label="Sınav seçin"
                >
                  <option value="">Sınav seçin</option>
                  {readyExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.weekLabel}) - {e.answerKey?.length ?? 0} soru
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label htmlFor="optic-student">Öğrenci</Form.Label>
                <Form.Select
                  id="optic-student"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={!selectedExamId}
                  aria-label="Öğrenci seçin"
                >
                  <option value="">Öğrenci seçin</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.studentNo})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {selectedExamId && questionCount > 0 && selectedExam?.answerKey && selectedExam.answerKey.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0">
              <i className="bi bi-ui-checks-grid me-2" />
              Cevap Girişi ({questionCount} soru)
            </h6>
          </Card.Header>
          <Card.Body>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <CameraCapture
                  onCapture={handleCapture}
                  disabled={loading}
                />
                {capturedImage && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOcrAndSave}
                      disabled={ocrLoading || !selectedStudentId}
                      aria-label="OCR ile oku ve kaydet"
                    >
                      {ocrLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                          OCR...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cpu me-1" />
                          OCR ile Oku ve Kaydet
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        if (capturedImage) URL.revokeObjectURL(capturedImage);
                        setCapturedImage(null);
                        setCapturedBlob(null);
                      }}
                      aria-label="Fotoğrafı kaldır"
                    >
                      <i className="bi bi-x-lg me-1" />
                      Kaldır
                    </Button>
                  </>
                )}
              </div>
              {capturedImage && (
                <div className="rounded overflow-hidden border bg-dark mb-3">
                  <img
                    src={capturedImage}
                    alt="Çekilen optik form"
                    className="img-fluid"
                    style={{ maxHeight: 200 }}
                  />
                </div>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {Array.from({ length: questionCount }, (_, i) => (
                <div key={i} className="d-flex align-items-center gap-1">
                  <span className="small text-muted" style={{ minWidth: 28 }}>
                    {i + 1}.
                  </span>
                  <Form.Select
                    size="sm"
                    style={{ width: 60 }}
                    value={answers[i] ?? ''}
                    onChange={(e) => handleAnswerChange(i, e.target.value)}
                    aria-label={`Soru ${i + 1} cevabı`}
                  >
                    <option value="">-</option>
                    {OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Form.Select>
                </div>
              ))}
            </div>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || !selectedStudentId}
              aria-label="Optik tarama sonucunu kaydet"
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2" />
                  Tara ve Kaydet
                </>
              )}
            </Button>
          </Card.Body>
        </Card>
      )}

      {selectedExamId && readyExams.length === 0 && (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-file-earmark-text fs-1 d-block mb-2" />
            <p className="mb-0">Hazır sınav bulunamadı.</p>
            <p className="small mb-0">
              <a href="/dashboard/olusturulan-sinavlar">Oluşturulan Sınavlar</a> sayfasından cevap
              anahtarı girilmiş hazır bir sınav oluşturun.
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
