/**
 * Analiz detay sayfası - tüm sorular ve öğretmen düzeltme
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Form, Modal } from 'react-bootstrap';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { EditablePredictionResults } from '../components/EditablePredictionResults';
import type { PDFAnalysisResponse, QuestionAnalysisResult } from '../types/prediction';

function getCurrentWeekLabel(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

export function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { analyses, updateAnalysis, addExam, updateExam, getExamByAnalysisId } = useTeacherData();
  const [showExamModal, setShowExamModal] = useState(false);
  const [weekLabel, setWeekLabel] = useState(getCurrentWeekLabel());

  const analysis = id ? analyses.find((a) => a.id === id) : null;

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

  const results = analysis.results as PDFAnalysisResponse;
  const items = results?.results ?? [];

  const handleQuestionUpdate = (questionIndex: number, subjectCode: string, topicLabel: string) => {
    const newResults: QuestionAnalysisResult[] = items.map((item, i) => {
      if (i !== questionIndex) return item;
      return {
        ...item,
        subject: [{ label: subjectCode, confidence: 1 }],
        topic: [{ label: topicLabel, confidence: 1 }],
      };
    });
    updateAnalysis(analysis.id, {
      results: {
        ...results,
        results: newResults,
      },
    });
  };

  const exam = getExamByAnalysisId(analysis.id);

  const handleCreateExam = () => {
    const newExam = addExam({
      analysisId: analysis.id,
      title: analysis.title,
      weekLabel,
      date: analysis.date.split('T')[0] ?? new Date().toISOString().split('T')[0],
      status: 'draft',
    });
    updateAnalysis(analysis.id, { examId: newExam.id });
    setShowExamModal(false);
  };

  const handleMarkExamReady = () => {
    if (exam) updateExam(exam.id, { status: 'ready' });
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
          <h4 className="fw-bold mb-1">{analysis.title}</h4>
          <p className="text-muted small mb-0">
            {new Date(analysis.date).toLocaleString('tr-TR')} ·{' '}
            {analysis.analyzedQuestions} / {analysis.totalQuestions} soru
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {exam ? (
            <>
              <Badge bg={exam.status === 'ready' ? 'success' : 'warning'} className="align-self-center">
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
              <Button variant="primary" size="sm" onClick={() => setShowExamModal(true)}>
                <i className="bi bi-plus-circle me-1" />
                Sınav Oluştur
              </Button>
              <Badge bg="info" className="align-self-center">
                PDF
              </Badge>
            </>
          )}
        </div>
      </div>

      <Modal show={showExamModal} onHide={() => setShowExamModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Sınav Oluştur</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Hafta Etiketi</Form.Label>
            <Form.Control
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              placeholder="2025-W08"
              aria-label="Hafta etiketi"
            />
            <Form.Text className="text-muted">Örn: 2025-W08 veya 8-14 Şubat 2025</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExamModal(false)}>
            İptal
          </Button>
          <Button variant="primary" onClick={handleCreateExam}>
            Oluştur
          </Button>
        </Modal.Footer>
      </Modal>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="py-3">
          <p className="text-muted small mb-0">
            <i className="bi bi-info-circle me-1" />
            LLM yanlış tahmin verdiğinde ders veya konu etiketini düzenleyebilirsiniz. Değişiklikler
            otomatik kaydedilir.
          </p>
        </Card.Body>
      </Card>

      <div className="d-flex flex-column gap-3">
        {items.map((result, index) => (
          <Card key={result.question_id ?? index} className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
              <h6 className="fw-semibold mb-0">Soru {index + 1}</h6>
              {result.has_visual && (
                <Badge bg="warning" text="dark">
                  <i className="bi bi-image me-1" />
                  Görsel İçerir
                </Badge>
              )}
            </Card.Header>
            <Card.Body className="p-4">
              <p className="text-muted small mb-4 lh-base text-break" style={{ whiteSpace: 'pre-wrap' }}>
                {result.question_text}
              </p>
              <EditablePredictionResults
                subject={result.subject}
                topic={result.topic}
                onUpdate={(subjectCode, topicLabel) => handleQuestionUpdate(index, subjectCode, topicLabel)}
              />
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
}
