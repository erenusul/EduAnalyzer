/**
 * PDF'den sınav analizi sayfası
 */

import { useState, useRef, type FormEvent, type ChangeEvent, type DragEvent } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import type { PDFAnalysisResponse } from '../types/prediction';
import { Link } from 'react-router-dom';
import { EditablePredictionResults } from '../components/EditablePredictionResults';
import { useTeacherData } from '../contexts/TeacherDataContext';
import type { QuestionAnalysisResult } from '../types/prediction';

const FIVE_MB = 5 * 1024 * 1024;

export function PdfExamAnalysis() {
  const { analyzePdf, updateAnalysis, getExamByAnalysisId } = useTeacherData();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);
  const [useOCR, setUseOCR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [pdfResults, setPdfResults] = useState<PDFAnalysisResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Lütfen sadece PDF dosyası seçiniz.');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setPdfResults(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
      setPdfResults(null);
    } else if (file) {
      setError('Lütfen sadece PDF dosyası seçiniz.');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Lütfen bir PDF dosyası seçiniz.');
      return;
    }

    if (useOCR) {
      const fileSizeMB = selectedFile.size / (1024 * 1024);
      let msg = 'OCR işlemi çok yavaştır ve 5-15 dakika sürebilir. ';
      if (fileSizeMB > 5) {
        msg += `Bu dosya (${fileSizeMB.toFixed(1)} MB) büyük olduğu için daha da uzun sürebilir. `;
      }
      msg += 'Devam etmek istiyor musunuz?';
      if (!confirm(msg)) return;
    }

    setLoading(true);
    setError(null);
    setPdfResults(null);
    setProgressMessage(
      useOCR
        ? 'PDF işleniyor ve görsellerden metin çıkarılıyor... (Bu işlem 5-15 dakika sürebilir, lütfen bekleyin)'
        : 'PDF analiz ediliyor... (Bu işlem 1-3 dakika sürebilir)'
    );

    try {
      const record = await analyzePdf(selectedFile, useOCR);
      const result = record.results as PDFAnalysisResponse;
      setPdfResults(result);
      setLastAnalysisId(record.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'PDF analizi sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
      setProgressMessage(null);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
    setPdfResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleZoneClick = () => fileInputRef.current?.click();

  const handleZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleZoneClick();
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">PDF'den Sınav Analizi</h4>
        <p className="text-muted mb-0">
          PDF dosyası yükleyerek tüm soruların ders ve konu tahminlerini alın.
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">PDF Dosyası</Form.Label>
              <div
                role="button"
                tabIndex={0}
                className={`file-upload-zone ${selectedFile ? 'has-file' : ''} ${dragOver ? 'dragover' : ''}`}
                onClick={handleZoneClick}
                onKeyDown={handleZoneKeyDown}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                aria-label="PDF dosyası yüklemek için tıklayın veya sürükleyip bırakın"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="d-none"
                  aria-label="PDF dosyası seçin"
                />
                {selectedFile ? (
                  <>
                    <i className="bi bi-file-earmark-pdf fs-1 text-success d-block mb-2" aria-hidden />
                    <div className="fw-semibold">{selectedFile.name}</div>
                    <div className="small text-muted">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div className="small text-muted mt-1">Yeni dosya seçmek için tıklayın</div>
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up fs-1 text-muted d-block mb-2" aria-hidden />
                    <div className="fw-medium">PDF dosyasını sürükleyip bırakın veya tıklayarak seçin</div>
                    <div className="small text-muted mt-1">Sadece .pdf dosyaları kabul edilir</div>
                  </>
                )}
              </div>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                id="use-ocr"
                label="OCR kullan (görsellerden metin çıkar)"
                checked={useOCR}
                onChange={(e) => setUseOCR(e.target.checked)}
                disabled={loading}
              />
              <Form.Text className="d-block mt-1 text-warning">
                <i className="bi bi-exclamation-triangle me-1" />
                OCR işlemi çok yavaştır (5-15 dakika). Sadece görsel içeren sorular için gerekli.
              </Form.Text>
            </Form.Group>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
                <i className="bi bi-exclamation-circle me-2" />
                {error}
              </Alert>
            )}

            {loading && progressMessage && (
              <Alert variant="info" className="mb-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
                  <strong>İşlem devam ediyor</strong>
                </div>
                <p className="mb-0 small">{progressMessage}</p>
                {useOCR && selectedFile && selectedFile.size > FIVE_MB && (
                  <div className="mt-2 small text-muted">
                    Büyük dosyalar OCR ile işlenirken 5-10 dakika sürebilir.
                  </div>
                )}
              </Alert>
            )}

            <div className="d-flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading || !selectedFile}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                    Analiz ediliyor...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill me-2" />
                    PDF Analiz Et
                  </>
                )}
              </Button>
              {selectedFile && (
                <Button variant="outline-secondary" onClick={handleClear} disabled={loading}>
                  Temizle
                </Button>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>

      {pdfResults && (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body className="p-4">
              <h5 className="fw-semibold mb-3">
                <i className="bi bi-check-circle text-success me-2" />
                Analiz Özeti
              </h5>
              <p className="mb-0">
                <strong>{pdfResults.analyzed_questions}</strong> / {pdfResults.total_questions} soru analiz edildi
              </p>
              {pdfResults.warning && (
                <Alert variant="warning" className="mt-3 mb-0">
                  <i className="bi bi-info-circle me-2" />
                  {pdfResults.warning}
                </Alert>
              )}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm mb-3">
            <Card.Body className="py-3">
              <p className="text-muted small mb-0">
                <i className="bi bi-pencil-square me-1" />
                LLM yanlış tahmin verdiğinde ders veya konu etiketini düzenleyebilirsiniz. Değişiklikler
                otomatik kaydedilir.
              </p>
              <div className="d-flex flex-wrap gap-2 mt-2">
                {lastAnalysisId && (
                  <Link
                    to={`/dashboard/analiz-gecmisi/${lastAnalysisId}`}
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="bi bi-list-check me-1" />
                    Tüm Soru Analizlerini Görüntüle
                  </Link>
                )}
                {lastAnalysisId && !getExamByAnalysisId(lastAnalysisId) && (
                  <Link
                    to={`/dashboard/analiz-gecmisi/${lastAnalysisId}`}
                    className="btn btn-sm btn-primary"
                  >
                    <i className="bi bi-plus-circle me-1" />
                    Sınav Oluştur
                  </Link>
                )}
              </div>
            </Card.Body>
          </Card>

          <div className="d-flex flex-column gap-3">
            {pdfResults.results.map((result, index) => (
              <Card key={result.question_id ?? index} className="border-0 shadow-sm">
                <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                  <h6 className="fw-semibold mb-0">Soru {index + 1}</h6>
                  {result.has_visual && (
                    <span className="badge bg-warning text-dark">
                      <i className="bi bi-image me-1" />
                      Görsel İçerir
                    </span>
                  )}
                </Card.Header>
                <Card.Body className="p-4">
                  <p className="text-muted small mb-4 lh-base text-break" style={{ whiteSpace: 'pre-wrap' }}>
                    {result.question_text}
                  </p>
                  <EditablePredictionResults
                    subject={result.subject}
                    topic={result.topic}
                    onUpdate={(subjectCode, topicLabel) => {
                      if (!lastAnalysisId) return;
                      const newResults: QuestionAnalysisResult[] = pdfResults.results.map(
                        (item, i) => {
                          if (i !== index) return item;
                          return {
                            ...item,
                            subject: [{ label: subjectCode, confidence: 1 }],
                            topic: [{ label: topicLabel, confidence: 1 }],
                          };
                        }
                      );
                      updateAnalysis(lastAnalysisId, {
                        results: { ...pdfResults, results: newResults },
                      });
                      setPdfResults((prev) =>
                        prev ? { ...prev, results: newResults } : null
                      );
                    }}
                  />
                </Card.Body>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
