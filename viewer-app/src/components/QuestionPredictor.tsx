import { useState } from 'react';
import { predictQuestion, PredictionResponse } from '../services/predictionApi';
import { SUBJECTS } from '../config/constants';
import './QuestionPredictor.css';

export function QuestionPredictor() {
  const [questionText, setQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Tahmin yapılırken bir hata oluştu.'
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

  const formatConfidence = (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const getSubjectName = (subjectCode: string): string => {
    return SUBJECTS[subjectCode as keyof typeof SUBJECTS] || subjectCode;
  };

  return (
    <div className="question-predictor">
      <div className="predictor-header">
        <h2>Soru Sınıflandırıcı</h2>
        <p className="subtitle">
          Soru metnini yapıştırın, hangi dersin hangi konusuna ait olduğunu öğrenin
        </p>
      </div>

      <form onSubmit={handleSubmit} className="predictor-form">
        <div className="form-group">
          <label htmlFor="question-text">Soru Metni</label>
          <textarea
            id="question-text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Örnek: Bu bilgiye göre aşağıdakilerden hangisi kurallı bir fiil cümlesidir?"
            rows={6}
            disabled={loading}
            className={error ? 'error' : ''}
          />
          <div className="char-count">
            {questionText.length} / 2000 karakter
          </div>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <strong>Hata:</strong> {error}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading || !questionText.trim()}
            className="submit-button"
          >
            {loading ? 'Tahmin Yapılıyor...' : 'Tahmin Et'}
          </button>
          {questionText && (
            <button
              type="button"
              onClick={handleClear}
              disabled={loading}
              className="clear-button"
            >
              Temizle
            </button>
          )}
        </div>
      </form>

      {predictions && (
        <div className="predictions-results">
          <h3>Tahmin Sonuçları</h3>

          <div className="prediction-section">
            <h4>Ders</h4>
            {predictions.subject.map((item, index) => (
              <div key={index} className="prediction-item">
                <div className="prediction-label">
                  {getSubjectName(item.label)}
                </div>
                <div className="prediction-confidence">
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                  <span className="confidence-value">
                    {formatConfidence(item.confidence)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="prediction-section">
            <h4>Konu</h4>
            {predictions.topic.map((item, index) => (
              <div key={index} className="prediction-item">
                <div className="prediction-label">{item.label}</div>
                <div className="prediction-confidence">
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                  <span className="confidence-value">
                    {formatConfidence(item.confidence)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}





