/**
 * Tek soru analizi sayfası
 */

import { useState, type FormEvent } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { predictQuestion } from '../services/predictionApi';
import type { PredictionResponse } from '../types/prediction';
import { PredictionResults } from '../components/PredictionResults';
import { useTeacherData } from '../contexts/TeacherDataContext';

const MAX_CHARS = 2000;

export function SingleQuestionAnalysis() {
  const { addAnalysis } = useTeacherData();
  const [questionText, setQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setError('Lütfen bir soru metni giriniz.');
      return;
    }

    setLoading(true);
    setError(null);
    setPredictions(null);
    try {
      const result = await predictQuestion({
        question_text: questionText.trim(),
        top_k_subject: 1,
        top_k_topic: 3,
      });
      setPredictions(result);
      addAnalysis({
        type: 'single',
        title: questionText.trim().slice(0, 50) + (questionText.length > 50 ? '...' : ''),
        date: new Date().toISOString(),
        totalQuestions: 1,
        analyzedQuestions: 1,
        results: result,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Tahmin yapılırken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuestionText('');
    setError(null);
    setPredictions(null);
  };

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Tek Soru Analizi</h4>
        <p className="text-muted mb-0">
          Soru metnini yapıştırarak ders ve konu tahmini alın.
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">Soru Metni</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Örnek: Bu bilgiye göre aşağıdakilerden hangisi kurallı bir fiil cümlesidir?"
                disabled={loading}
                isInvalid={!!error}
                className="lh-base"
              />
              <Form.Text className="text-muted">
                {questionText.length} / {MAX_CHARS} karakter
              </Form.Text>
            </Form.Group>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
                <i className="bi bi-exclamation-circle me-2" />
                {error}
              </Alert>
            )}

            <div className="d-flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading || !questionText.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                    Tahmin yapılıyor...
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-2" />
                    Tahmin Et
                  </>
                )}
              </Button>
              {questionText && (
                <Button variant="outline-secondary" onClick={handleClear} disabled={loading}>
                  Temizle
                </Button>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>

      {predictions && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white border-bottom py-3">
            <h5 className="fw-semibold mb-0">
              <i className="bi bi-check-circle text-success me-2" />
              Tahmin Sonuçları
            </h5>
          </Card.Header>
          <Card.Body className="p-4">
            <PredictionResults subject={predictions.subject} topic={predictions.topic} />
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
