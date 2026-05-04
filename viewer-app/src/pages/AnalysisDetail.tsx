/**
 * Analiz detay sayfası - tüm sorular ve öğretmen düzeltme
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Form } from 'react-bootstrap';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { useToast } from '../contexts/ToastContext';
import { EditablePredictionResults } from '../components/EditablePredictionResults';
import { parseUtcToLocal } from '../utils/dateUtils';
import { AnswerKeyEditor } from '../components/AnswerKeyEditor';
import type { PDFAnalysisResponse, QuestionAnalysisResult } from '../types/prediction';
import type { Exam } from '../types/teacher';

const MAX_SELECTED_QUESTIONS = 20;

function getCurrentWeekLabel(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

export function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { analyses, updateAnalysis, addExam, updateExam, getExamByAnalysisId } = useTeacherData();
  const { showToast } = useToast();
  const [weekLabel, setWeekLabel] = useState(getCurrentWeekLabel());
  const [examTitleDraft, setExamTitleDraft] = useState('');
  const [examWeekDraft, setExamWeekDraft] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [savingExam, setSavingExam] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysis = id ? analyses.find((a) => a.id === id) : null;
  const results = analysis?.results as PDFAnalysisResponse | undefined;
  const items = results?.results ?? [];
  const exam = analysis ? getExamByAnalysisId(analysis.id) : undefined;
  const examSyncId = exam?.id;
  const examSyncTitle = exam?.title ?? '';
  const examSyncWeek = exam?.weekLabel ?? '';

  const getQuestionId = (item: QuestionAnalysisResult) =>
    item?.question_id ?? (item as { questionId?: string })?.questionId ?? '';
  const displayItems: QuestionAnalysisResult[] =
    exam && Array.isArray(exam.selectedResults) && exam.selectedResults.length > 0
      ? (exam.selectedResults as QuestionAnalysisResult[]).map((sr) => {
          const fromAnalysis = items.find(
            (i) =>
              getQuestionId(i) && getQuestionId(i) === getQuestionId(sr as QuestionAnalysisResult)
          );
          return fromAnalysis ?? (sr as QuestionAnalysisResult);
        })
      : items;

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

  const handleSelectAll = useCallback((total: number) => {
    const maxCount = Math.min(total, MAX_SELECTED_QUESTIONS);
    setSelectedIndices(new Set(Array.from({ length: maxCount }, (_, i) => i)));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setAnswerKey([]);
  }, []);

  const handlePrepareExam = useCallback(async () => {
    if (!analysis || selectedIndices.size !== MAX_SELECTED_QUESTIONS) return;
    const filled = answerKey.filter((a) =>
      ['A', 'B', 'C', 'D'].includes(a?.trim().toUpperCase() || '')
    );
    if (filled.length !== MAX_SELECTED_QUESTIONS) return;
    setSavingExam(true);
    try {
      await addExam(
        {
          analysisId: analysis.id,
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
  }, [analysis, selectedIndices, weekLabel, answerKey, addExam, showToast]);

  const isAnswerKeyComplete =
    answerKey.length === MAX_SELECTED_QUESTIONS &&
    answerKey.every((a) => ['A', 'B', 'C', 'D'].includes(a?.trim().toUpperCase() || ''));

  useEffect(() => {
    if (selectedIndices.size !== MAX_SELECTED_QUESTIONS) setAnswerKey([]);
  }, [selectedIndices.size]);

  useEffect(() => {
    if (!examSyncId) return;
    setExamTitleDraft(examSyncTitle);
    setExamWeekDraft(examSyncWeek);
  }, [examSyncId, examSyncTitle, examSyncWeek]);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current);
    };
  }, []);

  const answerKeyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswerKeyRef = useRef<string[] | null>(null);

  const handleAnswerKeyChange = useCallback(
    (newAnswerKey: string[]) => {
      if (!exam) return;
      pendingAnswerKeyRef.current = newAnswerKey;
      if (answerKeyDebounceRef.current) clearTimeout(answerKeyDebounceRef.current);
      answerKeyDebounceRef.current = setTimeout(() => {
        updateExam(exam.id, { answerKey: newAnswerKey });
        answerKeyDebounceRef.current = null;
      }, 500);
    },
    [exam, updateExam]
  );

  const handleSaveClick = useCallback(async () => {
    setSaveStatus('saving');
    try {
      if (exam) {
        const titleTrim = examTitleDraft.trim();
        const weekTrim = examWeekDraft.trim();
        const metaChanged =
          titleTrim !== (exam.title ?? '').trim() || weekTrim !== (exam.weekLabel ?? '').trim();
        if (answerKeyDebounceRef.current) {
          clearTimeout(answerKeyDebounceRef.current);
          answerKeyDebounceRef.current = null;
        }
        const keyEditable = exam.status !== 'ready';
        const toSave = pendingAnswerKeyRef.current ?? exam.answerKey ?? [];
        const payload: Partial<Pick<Exam, 'title' | 'weekLabel' | 'answerKey'>> = {
          ...(metaChanged ? { title: titleTrim, weekLabel: weekTrim } : {}),
        };
        if (keyEditable) {
          payload.answerKey = toSave;
        }
        if (Object.keys(payload).length === 0) {
          setSaveStatus('idle');
          showToast('Kaydedilecek değişiklik yok.', 'info');
          return;
        }
        await updateExam(exam.id, payload);
      }
      setSaveStatus('saved');
      showToast('Değişiklikler kaydedildi.');
      if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current);
      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
        saveFeedbackTimeoutRef.current = null;
      }, 2500);
    } catch {
      setSaveStatus('idle');
      showToast('Kaydederken bir hata oluştu.', 'danger');
    }
  }, [exam, examTitleDraft, examWeekDraft, updateExam, showToast]);

  if (!analysis) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Analiz bulunamadı.</p>
        <Button variant="outline-primary" onClick={() => navigate('/dashboard/analiz-gecmisi')}>
          Analiz Geçmişine Dön
        </Button>
      </div>
    );
  }

  if (analysis.type !== 'pdf') {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Bu analiz türü için detay görünümü mevcut değil.</p>
        <Button variant="outline-primary" onClick={() => navigate('/dashboard/analiz-gecmisi')}>
          Analiz Geçmişine Dön
        </Button>
      </div>
    );
  }

  const handleQuestionUpdate = async (
    questionIndex: number,
    subjectCode: string,
    topicLabel: string,
    secondTopicLabel?: string
  ) => {
    const topicItems = [
      { label: topicLabel, confidence: 1 },
      ...(secondTopicLabel ? [{ label: secondTopicLabel, confidence: 1 }] : []),
    ];
    const targetItem = displayItems[questionIndex];
    const originalIndex = items.findIndex((i) => getQuestionId(i) === getQuestionId(targetItem));
    if (originalIndex < 0) return;
    const newResults: QuestionAnalysisResult[] = items.map((item, i) => {
      if (i !== originalIndex) return item;
      return {
        ...item,
        subject: [{ label: subjectCode, confidence: 1 }],
        topic: topicItems,
      };
    });
    setSaveStatus('saving');
    try {
      await updateAnalysis(analysis.id, {
        results: {
          ...results,
          results: newResults,
        },
      });
      setSaveStatus('saved');
      showToast('Değişiklikler kaydedildi.');
      if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current);
      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
        saveFeedbackTimeoutRef.current = null;
      }, 2500);
    } catch {
      setSaveStatus('idle');
      showToast('Kaydederken bir hata oluştu.', 'danger');
    }
  };

  const handleMarkExamReady = async () => {
    if (exam) await updateExam(exam.id, { status: 'ready' });
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <Button
            variant="link"
            className="p-0 mb-2 text-muted text-decoration-none"
            onClick={() => navigate('/dashboard/analiz-gecmisi')}
          >
            <i className="bi bi-arrow-left me-1" />
            Analiz Geçmişine Dön
          </Button>
          <h4 className="fw-bold mb-1">
            {exam ? examTitleDraft || exam.title : analysis.title}
          </h4>
          <p className="text-muted small mb-0">
            {exam && (
              <span className="d-block mb-1">
                Kaynak analiz: <span className="text-dark fw-medium">{analysis.title}</span>
              </span>
            )}
            {parseUtcToLocal(analysis.date).toLocaleString('tr-TR')} · {analysis.analyzedQuestions}{' '}
            / {analysis.totalQuestions} soru
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveClick}
            disabled={saveStatus === 'saving'}
            aria-label="Değişiklikleri kaydet"
          >
            {saveStatus === 'saving' ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                Kaydediliyor...
              </>
            ) : (
              <>
                <i className="bi bi-save me-1" />
                Kaydet
              </>
            )}
          </Button>
          {exam ? (
            <>
              <Badge
                bg={exam.status === 'ready' ? 'success' : 'warning'}
                className="align-self-center"
              >
                {exam.status === 'ready' ? 'Hazır' : 'Taslak'}
              </Badge>
              {exam.status === 'draft' && (
                <Button variant="success" size="sm" onClick={handleMarkExamReady}>
                  <i className="bi bi-check-circle me-1" />
                  Sınavı Hazırla
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleSelectAll(items.length)}
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
              </div>
              <Badge bg="info" className="align-self-center">
                PDF
              </Badge>
            </>
          )}
        </div>
      </div>

      {!exam && selectedIndices.size === MAX_SELECTED_QUESTIONS && (
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
              aria-label="Sınavı oluştur ve hazırla"
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
              Tüm {MAX_SELECTED_QUESTIONS} cevabı girdikten sonra sınav veritabanına kaydedilir ve
              öğrenci mobil uygulamasında kullanılabilir.
            </p>
          </Card.Body>
        </Card>
      )}

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <p className="text-muted small mb-0">
            <i className="bi bi-info-circle me-1" />
            LLM yanlış tahmin verdiğinde ders veya konu etiketini düzenleyebilirsiniz. Değişiklikler
            otomatik kaydedilir.
          </p>
          {saveStatus === 'saving' && (
            <span className="badge bg-secondary">
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
              Kaydediliyor...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="badge bg-success">
              <i className="bi bi-check-circle me-1" />
              Kaydedildi
            </span>
          )}
        </Card.Body>
      </Card>

      {exam && (
        <Card className="border-0 shadow-sm mb-3">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0">
              <i className="bi bi-journal-text me-2" />
              Sınav bilgisi
            </h6>
          </Card.Header>
          <Card.Body className="p-4">
            <div className="row g-3">
              <div className="col-md-8">
                <Form.Group>
                  <Form.Label>Sınav başlığı</Form.Label>
                  <Form.Control
                    value={examTitleDraft}
                    onChange={(e) => setExamTitleDraft(e.target.value)}
                    placeholder="Örn. 8. Sınıf Türkçe Deneme 1"
                    aria-label="Sınav başlığı"
                  />
                  <Form.Text className="text-muted">
                    Öğretmen paneli ve öğrenci uygulamasında listelenen başlıktır.
                  </Form.Text>
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>Hafta etiketi</Form.Label>
                  <Form.Control
                    value={examWeekDraft}
                    onChange={(e) => setExamWeekDraft(e.target.value)}
                    placeholder="2025-W08"
                    aria-label="Hafta etiketi"
                    style={{ maxWidth: 280 }}
                  />
                </Form.Group>
              </div>
            </div>
            <p className="text-muted small mb-0 mt-2">
              <i className="bi bi-info-circle me-1" />
              Değişiklikleri kaydetmek için üstteki <strong>Kaydet</strong> düğmesini kullanın.
            </p>
          </Card.Body>
        </Card>
      )}

      {exam && (
        <Card className="border-0 shadow-sm mb-3">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0">
              <i className="bi bi-key me-2" />
              Cevap Anahtarı (
              {Array.isArray(exam.selectedResults)
                ? exam.selectedResults.length
                : items.length}{' '}
              soru)
            </h6>
          </Card.Header>
          <Card.Body className="p-4">
            <AnswerKeyEditor
              questionCount={
                Array.isArray(exam.selectedResults) ? exam.selectedResults.length : items.length
              }
              value={exam.answerKey ?? []}
              onChange={handleAnswerKeyChange}
              disabled={exam.status === 'ready'}
            />
          </Card.Body>
        </Card>
      )}

      <div className="d-flex flex-column gap-3">
        {displayItems.map((result, index) => (
          <Card key={result.question_id ?? index} className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
              <div className="d-flex align-items-center gap-2">
                {!exam && (
                  <Form.Check
                    type="checkbox"
                    id={`detail-q-${index}`}
                    checked={selectedIndices.has(index)}
                    onChange={() => toggleQuestionSelection(index)}
                    disabled={
                      selectedIndices.size >= MAX_SELECTED_QUESTIONS && !selectedIndices.has(index)
                    }
                    aria-label={`Soru ${index + 1} seç`}
                  />
                )}
                <h6 className="fw-semibold mb-0">Soru {index + 1}</h6>
              </div>
              {result.has_visual && (
                <Badge bg="warning" text="dark">
                  <i className="bi bi-image me-1" />
                  Görsel İçerir
                </Badge>
              )}
            </Card.Header>
            <Card.Body className="p-4">
              <p
                className="text-muted small mb-4 lh-base text-break"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {result.question_text}
              </p>
              <EditablePredictionResults
                subject={result.subject}
                topic={result.topic}
                onUpdate={(subjectCode, topicLabel, secondTopicLabel) =>
                  handleQuestionUpdate(index, subjectCode, topicLabel, secondTopicLabel)
                }
              />
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
}
