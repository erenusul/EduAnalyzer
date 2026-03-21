/**
 * PDF'den sınav analizi sayfası
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type FormEvent,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import type { PDFAnalysisResponse } from '../types/prediction';
import { Link } from 'react-router-dom';
import { EditablePredictionResults } from '../components/EditablePredictionResults';
import { AnswerKeyEditor } from '../components/AnswerKeyEditor';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';
import type { QuestionAnalysisResult } from '../types/prediction';

const FIVE_MB = 5 * 1024 * 1024;

const MAX_SELECTED_QUESTIONS = 20;

function getCurrentWeekLabel(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

export function PdfExamAnalysis() {
  const { analyzePdf, updateAnalysis, getExamByAnalysisId, addExam, analyses } = useTeacherData();
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);
  const [useOCR, setUseOCR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [pdfResults, setPdfResults] = useState<PDFAnalysisResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    pages: { page: number; text: string; len: number }[];
    total_chars: number;
  } | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [weekLabel, setWeekLabel] = useState(getCurrentWeekLabel());
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [savingExam, setSavingExam] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleQuestionSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < MAX_SELECTED_QUESTIONS) {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!pdfResults) return;
    const maxCount = Math.min(pdfResults.results.length, MAX_SELECTED_QUESTIONS);
    setSelectedIndices(new Set(Array.from({ length: maxCount }, (_, i) => i)));
  }, [pdfResults]);

  const handleClearSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setAnswerKey([]);
  }, []);

  const handlePrepareExam = useCallback(async () => {
    if (!lastAnalysisId || selectedIndices.size !== MAX_SELECTED_QUESTIONS) return;
    const filled = answerKey.filter((a) =>
      ['A', 'B', 'C', 'D'].includes(a?.trim().toUpperCase() || '')
    );
    if (filled.length !== MAX_SELECTED_QUESTIONS) return;
    const analysis = analyses.find((a) => a.id === lastAnalysisId);
    if (!analysis) return;
    setSavingExam(true);
    try {
      await addExam(
        {
          analysisId: lastAnalysisId,
          title: analysis.title,
          weekLabel,
          date: analysis.date.split('T')[0] ?? new Date().toISOString().split('T')[0],
          status: 'ready',
        },
        Array.from(selectedIndices).sort((a, b) => a - b),
        answerKey
      );
      setSelectedIndices(new Set());
      setAnswerKey([]);
      showToast('Sınav oluşturuldu.');
    } catch {
      showToast('Sınav oluşturulurken bir hata oluştu.', 'danger');
    } finally {
      setSavingExam(false);
    }
  }, [lastAnalysisId, selectedIndices, weekLabel, answerKey, analyses, addExam, showToast]);

  const isAnswerKeyComplete =
    answerKey.length === MAX_SELECTED_QUESTIONS &&
    answerKey.every((a) => ['A', 'B', 'C', 'D'].includes(a?.trim().toUpperCase() || ''));

  useEffect(() => {
    if (selectedIndices.size !== MAX_SELECTED_QUESTIONS) setAnswerKey([]);
  }, [selectedIndices.size]);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current);
    };
  }, []);

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
      setSelectedIndices(new Set());
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
      showToast('PDF analiz edildi.');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? 'PDF analizi sırasında bir hata oluştu.');
      setError(msg);
      setDebugInfo(null);
      showToast(msg, 'danger');
    } finally {
      setLoading(false);
      setProgressMessage(null);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
    setPdfResults(null);
    setDebugInfo(null);
    setSelectedIndices(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDiagnose = async () => {
    if (!selectedFile) return;
    setDebugInfo(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/pdf-debug`, {
        method: 'POST',
        body: formData,
      });
      const text = await res.text();
      if (!res.ok) throw new Error('Tanılama başarısız');
      const data = text ? JSON.parse(text) : {};
      setDebugInfo(data);
    } catch (e) {
      setError((e as Error).message + ' - ML servisi çalışıyor mu?');
    }
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
        <h4 className="fw-bold mb-1">PDF&apos;den Sınav Analizi</h4>
        <p className="text-muted mb-0">
          PDF dosyası yükleyerek tüm soruların ders ve konu tahminlerini alın.
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label htmlFor="pdf-file-input" className="fw-medium">
                PDF Dosyası
              </Form.Label>
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
                  id="pdf-file-input"
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
                    <i
                      className="bi bi-file-earmark-pdf fs-1 text-success d-block mb-2"
                      aria-hidden
                    />
                    <div className="fw-semibold">{selectedFile.name}</div>
                    <div className="small text-muted">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div className="small text-muted mt-1">Yeni dosya seçmek için tıklayın</div>
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up fs-1 text-muted d-block mb-2" aria-hidden />
                    <div className="fw-medium">
                      PDF dosyasını sürükleyip bırakın veya tıklayarak seçin
                    </div>
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
                {selectedFile && (
                  <div className="mt-3">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={handleDiagnose}
                      disabled={loading}
                    >
                      <i className="bi bi-bug me-1" />
                      PDF Tanıla (çıkarılan metni gör)
                    </Button>
                  </div>
                )}
              </Alert>
            )}
            {debugInfo && (
              <Alert variant="secondary" className="mb-4">
                <h6 className="mb-2">
                  <i className="bi bi-file-text me-1" />
                  PDF Tanılama: Toplam {debugInfo.total_chars} karakter
                </h6>
                {debugInfo.pages?.map((p) => (
                  <details key={p.page} className="mb-2">
                    <summary>
                      Sayfa {p.page} ({p.len} karakter)
                    </summary>
                    <pre
                      className="small bg-dark text-light p-2 rounded mt-1 mb-0"
                      style={{ maxHeight: 150, overflow: 'auto' }}
                    >
                      {p.text || '(boş)'}
                    </pre>
                  </details>
                ))}
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
                aria-label="PDF analizini başlat"
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden
                    />
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
                <strong>{pdfResults.analyzed_questions}</strong> / {pdfResults.total_questions} soru
                analiz edildi
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
            <Card.Body className="py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <p className="text-muted small mb-0">
                  <i className="bi bi-pencil-square me-1" />
                  LLM yanlış tahmin verdiğinde ders veya konu etiketini düzenleyebilirsiniz.
                  Değişiklikler otomatik kaydedilir.
                </p>
                {saveStatus === 'saving' && (
                  <span className="badge bg-secondary">
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden
                    />
                    Kaydediliyor...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="badge bg-success">
                    <i className="bi bi-check-circle me-1" />
                    Kaydedildi
                  </span>
                )}
              </div>
              {lastAnalysisId && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSaveStatus('saved');
                    if (saveFeedbackTimeoutRef.current)
                      clearTimeout(saveFeedbackTimeoutRef.current);
                    saveFeedbackTimeoutRef.current = setTimeout(() => {
                      setSaveStatus('idle');
                      saveFeedbackTimeoutRef.current = null;
                    }, 2500);
                  }}
                  disabled={saveStatus === 'saving'}
                  aria-label="Değişiklikleri kaydet"
                >
                  <i className="bi bi-save me-1" />
                  Kaydet
                </Button>
              )}
              <div className="d-flex flex-wrap gap-2 align-items-center">
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
                  <>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleSelectAll}
                      aria-label="Tümünü seç (en fazla 20)"
                    >
                      Tümünü Seç
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleClearSelection}
                      disabled={selectedIndices.size === 0}
                      aria-label="Seçimi temizle"
                    >
                      Seçimi Temizle
                    </Button>
                    <span className="text-muted small">
                      {selectedIndices.size} / {MAX_SELECTED_QUESTIONS} soru seçildi
                    </span>
                  </>
                )}
              </div>
            </Card.Body>
          </Card>

          {selectedIndices.size === MAX_SELECTED_QUESTIONS &&
            !getExamByAnalysisId(lastAnalysisId!) && (
              <Card className="border-0 shadow-sm mb-3">
                <Card.Header className="bg-white border-bottom py-3">
                  <h6 className="fw-semibold mb-0">
                    <i className="bi bi-key me-2" />
                    Cevap Anahtarı ({MAX_SELECTED_QUESTIONS} soru)
                  </h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Hafta Etiketi</Form.Label>
                    <Form.Control
                      value={weekLabel}
                      onChange={(e) => setWeekLabel(e.target.value)}
                      placeholder="2025-W08"
                      aria-label="Hafta etiketi"
                      style={{ maxWidth: 200 }}
                    />
                  </Form.Group>
                  <AnswerKeyEditor
                    questionCount={MAX_SELECTED_QUESTIONS}
                    value={answerKey}
                    onChange={setAnswerKey}
                    disabled={savingExam}
                  />
                  <Button
                    variant="success"
                    size="lg"
                    className="mt-3"
                    onClick={handlePrepareExam}
                    disabled={!isAnswerKeyComplete || savingExam}
                  >
                    {savingExam ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden
                        />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2" />
                        Sınavı Hazırla
                      </>
                    )}
                  </Button>
                  <p className="text-muted small mt-2 mb-0">
                    Tüm {MAX_SELECTED_QUESTIONS} cevabı girdikten sonra sınav veritabanına
                    kaydedilir ve öğrenci mobil uygulamasında kullanılabilir.
                  </p>
                </Card.Body>
              </Card>
            )}

          <div className="d-flex flex-column gap-3">
            {pdfResults.results.map((result, index) => (
              <Card key={result.question_id ?? index} className="border-0 shadow-sm">
                <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                  <div className="d-flex align-items-center gap-2">
                    {lastAnalysisId && !getExamByAnalysisId(lastAnalysisId) && (
                      <Form.Check
                        type="checkbox"
                        id={`pdf-q-${index}`}
                        checked={selectedIndices.has(index)}
                        onChange={() => toggleQuestionSelection(index)}
                        disabled={
                          selectedIndices.size >= MAX_SELECTED_QUESTIONS &&
                          !selectedIndices.has(index)
                        }
                        aria-label={`Soru ${index + 1} seç`}
                      />
                    )}
                    <h6 className="fw-semibold mb-0">Soru {index + 1}</h6>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {result.has_visual && (
                      <span className="badge bg-warning text-dark">
                        <i className="bi bi-image me-1" />
                        Görsel İçerir
                      </span>
                    )}
                    {result.quality_warning && (
                      <span className="badge bg-info text-dark" title={result.quality_warning}>
                        <i className="bi bi-exclamation-triangle me-1" />
                        Kalite Uyarısı
                      </span>
                    )}
                  </div>
                </Card.Header>
                <Card.Body className="p-4">
                  {result.quality_warning && (
                    <Alert variant="info" className="py-2 px-3 mb-3 small">
                      <i className="bi bi-info-circle me-1" />
                      {result.quality_warning}
                    </Alert>
                  )}
                  <p
                    className="text-body-secondary small mb-4 lh-base text-break"
                    style={{ whiteSpace: 'pre-wrap', minHeight: '2em' }}
                  >
                    {result.question_text || '(Soru metni yüklenemedi)'}
                  </p>
                  <EditablePredictionResults
                    subject={result.subject}
                    topic={result.topic}
                    onUpdate={async (subjectCode, topicLabel, secondTopicLabel) => {
                      if (!lastAnalysisId) return;
                      const topicItems = [
                        { label: topicLabel, confidence: 1 },
                        ...(secondTopicLabel ? [{ label: secondTopicLabel, confidence: 1 }] : []),
                      ];
                      const newResults: QuestionAnalysisResult[] = pdfResults.results.map(
                        (item, i) => {
                          if (i !== index) return item;
                          return {
                            ...item,
                            subject: [{ label: subjectCode, confidence: 1 }],
                            topic: topicItems,
                          };
                        }
                      );
                      setSaveStatus('saving');
                      try {
                        await updateAnalysis(lastAnalysisId, {
                          results: { ...pdfResults, results: newResults },
                        });
                        setPdfResults((prev) => (prev ? { ...prev, results: newResults } : null));
                        setSaveStatus('saved');
                        if (saveFeedbackTimeoutRef.current)
                          clearTimeout(saveFeedbackTimeoutRef.current);
                        saveFeedbackTimeoutRef.current = setTimeout(() => {
                          setSaveStatus('idle');
                          saveFeedbackTimeoutRef.current = null;
                        }, 2500);
                      } catch {
                        setSaveStatus('idle');
                      }
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
