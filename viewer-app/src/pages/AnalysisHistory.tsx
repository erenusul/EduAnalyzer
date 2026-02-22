/**
 * Analiz geçmişi sayfası
 */

import { useState } from 'react';
import { Card, Table, Button, Badge, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTeacherData } from '../contexts/TeacherDataContext';
import { PredictionResults } from '../components/PredictionResults';
import type { PDFAnalysisResponse, PredictionResponse } from '../types/prediction';

function PdfResultsPreview({ results }: { results: PDFAnalysisResponse }) {
  const items = results.results;
  if (!items || !Array.isArray(items)) return null;
  return (
    <div className="analysis-results-preview">
      {items.slice(0, 3).map((r, i) => (
        <Card key={i} className="mb-3">
          <Card.Body>
            <h6 className="small">Soru {i + 1}</h6>
            <p className="small text-muted mb-2">
              {r.question_text.substring(0, 150)}...
            </p>
            <PredictionResults subject={r.subject} topic={r.topic} />
          </Card.Body>
        </Card>
      ))}
      {items.length > 3 && (
        <p className="text-muted small">+{items.length - 3} soru daha</p>
      )}
    </div>
  );
}

export function AnalysisHistory() {
  const { analyses, deleteAnalysis, getExamByAnalysisId } = useTeacherData();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAnalysis = selectedId
    ? analyses.find((a) => a.id === selectedId)
    : null;

  const handleDelete = (id: string, title: string) => {
    if (confirm(`"${title}" analizini silmek istediğinize emin misiniz?`)) {
      deleteAnalysis(id);
      setSelectedId(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Analiz Geçmişi</h4>
        <p className="text-muted mb-0">
          Yapılan PDF ve tek soru analizlerinin geçmişi.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Tarih</th>
                <th>Başlık</th>
                <th>Tür</th>
                <th>Soru</th>
                <th>Sınav</th>
                <th className="text-end">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {analyses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    <i className="bi bi-clock-history fs-1 d-block mb-2" />
                    Henüz analiz yapılmamış
                  </td>
                </tr>
              ) : (
                analyses.map((a) => (
                  <tr key={a.id}>
                    <td className="small">
                      {new Date(a.date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="fw-medium">{a.title}</td>
                    <td>
                      <Badge bg={a.type === 'pdf' ? 'primary' : 'secondary'}>
                        {a.type === 'pdf' ? 'PDF' : 'Tek Soru'}
                      </Badge>
                    </td>
                    <td>
                      {a.analyzedQuestions} / {a.totalQuestions}
                    </td>
                    <td>
                      {a.type === 'pdf' ? (
                        getExamByAnalysisId(a.id) ? (
                          <Badge bg={getExamByAnalysisId(a.id)?.status === 'ready' ? 'success' : 'warning'}>
                            {getExamByAnalysisId(a.id)?.status === 'ready' ? 'Hazır' : 'Taslak'}
                          </Badge>
                        ) : (
                          <Link
                            to={`/dashboard/analiz-gecmisi/${a.id}`}
                            className="btn btn-sm btn-outline-success"
                          >
                            <i className="bi bi-plus me-1" />
                            Sınav Oluştur
                          </Link>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end">
                      {a.type === 'pdf' && (
                        <Link
                          to={`/dashboard/analiz-gecmisi/${a.id}`}
                          className="btn btn-sm btn-primary me-1"
                        >
                          <i className="bi bi-list-check me-1" />
                          Soru Analizleri
                        </Link>
                      )}
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => setSelectedId(a.id)}
                        className="me-1"
                      >
                        <i className="bi bi-eye" />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(a.id, a.title)}
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal
        show={!!selectedAnalysis}
        onHide={() => setSelectedId(null)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedAnalysis?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAnalysis ? (
            <div>
              <p className="text-muted small mb-3">
                {new Date(selectedAnalysis.date).toLocaleString('tr-TR')} ·{' '}
                {selectedAnalysis.analyzedQuestions} / {selectedAnalysis.totalQuestions} soru
              </p>
              {selectedAnalysis.type === 'pdf' ? (
                <PdfResultsPreview results={selectedAnalysis.results as PDFAnalysisResponse} />
              ) : selectedAnalysis.type === 'single' ? (
                <PredictionResults
                  subject={(selectedAnalysis.results as PredictionResponse).subject}
                  topic={(selectedAnalysis.results as PredictionResponse).topic}
                />
              ) : null}
            </div>
          ) : null}
        </Modal.Body>
      </Modal>
    </div>
  );
}
