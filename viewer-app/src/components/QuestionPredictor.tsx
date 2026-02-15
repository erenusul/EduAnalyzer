import { useState, useRef } from 'react';
import { predictQuestion, PredictionResponse, analyzePDF, PDFAnalysisResponse } from '../services/predictionApi';
import { SUBJECTS } from '../config/constants';
import './QuestionPredictor.css';

type TabType = 'text' | 'pdf';

export function QuestionPredictor() {
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [questionText, setQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [pdfResults, setPdfResults] = useState<PDFAnalysisResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useOCR, setUseOCR] = useState(false); // Default: OCR kapalı (daha hızlı)
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handlePDFSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Lütfen bir PDF dosyası seçiniz.');
      return;
    }

    // Warn user about OCR processing time
    if (useOCR) {
      const fileSizeMB = selectedFile.size / (1024 * 1024);
      let warningMessage = 'OCR işlemi çok yavaştır ve 5-15 dakika sürebilir. ';
      if (fileSizeMB > 5) {
        warningMessage += `Bu dosya (${fileSizeMB.toFixed(1)} MB) büyük olduğu için daha da uzun sürebilir. `;
      }
      warningMessage += 'Devam etmek istiyor musunuz?';
      
      if (!confirm(warningMessage)) {
        return;
      }
    }

    setLoading(true);
    setError(null);
    setPdfResults(null);
    if (useOCR) {
      setProgressMessage('PDF işleniyor ve görsellerden metin çıkarılıyor... (Bu işlem 5-15 dakika sürebilir, lütfen bekleyin)');
    } else {
      setProgressMessage('PDF analiz ediliyor... (Bu işlem 1-3 dakika sürebilir)');
    }

    try {
      const result = await analyzePDF(selectedFile, useOCR, 1, 3);
      setPdfResults(result);
      setProgressMessage(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'PDF analizi sırasında bir hata oluştu.'
      );
      setProgressMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFClear = () => {
    setSelectedFile(null);
    setError(null);
    setPdfResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          Soru metnini yapıştırın veya PDF yükleyin, hangi dersin hangi konusuna ait olduğunu öğrenin
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          type="button"
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('text');
            setError(null);
            setPdfResults(null);
          }}
        >
          📝 Metin Girişi
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'pdf' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('pdf');
            setError(null);
            setPredictions(null);
          }}
        >
          📄 PDF Yükle
        </button>
      </div>

      {/* Text Input Form */}
      {activeTab === 'text' && (
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
      )}

      {/* Text Predictions Results */}
      {activeTab === 'text' && predictions && (
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

      {/* PDF Upload Form */}
      {activeTab === 'pdf' && (
        <>
          <form onSubmit={handlePDFSubmit} className="predictor-form">
            <div className="form-group">
              <label htmlFor="pdf-file">PDF Dosyası</label>
              <input
                ref={fileInputRef}
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                disabled={loading}
                className={error ? 'error' : ''}
              />
              {selectedFile && (
                <div className="file-info">
                  <strong>Seçilen dosya:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useOCR}
                  onChange={(e) => setUseOCR(e.target.checked)}
                  disabled={loading}
                />
                <span>OCR kullan (görsellerden metin çıkar)</span>
              </label>
              <small className="form-hint">
                ⚠️ OCR işlemi çok yavaştır (5-15 dakika sürebilir). Sadece görsel içeren sorular için gerekli. 
                Çoğu PDF için OCR kapalı tutmanız önerilir.
              </small>
            </div>

            {error && (
              <div className="error-message" role="alert">
                <strong>Hata:</strong> {error}
              </div>
            )}

            {loading && progressMessage && (
              <div className="progress-message" role="status">
                <strong>⏳ İşlem devam ediyor:</strong> {progressMessage}
                <div className="progress-hint">
                  {useOCR && selectedFile && selectedFile.size > 5 * 1024 * 1024 && (
                    <small>Büyük dosyalar OCR ile işlenirken 5-10 dakika sürebilir. Lütfen bekleyin...</small>
                  )}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="submit-button"
              >
                {loading ? 'PDF Analiz Ediliyor...' : 'PDF Analiz Et'}
              </button>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handlePDFClear}
                  disabled={loading}
                  className="clear-button"
                >
                  Temizle
                </button>
              )}
            </div>
          </form>

          {pdfResults && (
            <div className="pdf-results">
              <div className="results-summary">
                <h3>PDF Analiz Sonuçları</h3>
                <p>
                  <strong>{pdfResults.analyzed_questions}</strong> / {pdfResults.total_questions} soru analiz edildi
                </p>
                {pdfResults.warning && (
                  <div className="warning-message" role="alert">
                    <strong>⚠️ Uyarı:</strong> {pdfResults.warning}
                  </div>
                )}
              </div>

              <div className="questions-list">
                {pdfResults.results.map((result, index) => (
                  <div key={result.question_id || index} className="question-result">
                    <div className="question-header">
                      <h4>Soru {index + 1}</h4>
                      {result.has_visual && (
                        <span className="visual-badge">🖼️ Görsel İçerir</span>
                      )}
                    </div>
                    <div className="question-text-preview">
                      {result.question_text.substring(0, 200)}
                      {result.question_text.length > 200 && '...'}
                    </div>
                    
                    <div className="prediction-section">
                      <h5>Ders</h5>
                      {result.subject.map((item, idx) => (
                        <div key={idx} className="prediction-item">
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
                      <h5>Konu</h5>
                      {result.topic.map((item, idx) => (
                        <div key={idx} className="prediction-item">
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
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}





