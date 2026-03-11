/**
 * Öğrenci sonuç detay sayfası - tek sınav sonucu, konu dağılımı
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Button, Table, Spinner, Alert } from 'react-bootstrap';
import { meApi } from '../services/backendApi';
import type { ExamResult } from '../types/teacher';
import type { BackendExamResult } from '../services/backendApi';

function toExamResult(r: BackendExamResult): ExamResult {
  return {
    id: r.id,
    studentId: r.studentId,
    examId: r.examId,
    correctCount: r.correctCount,
    wrongCount: r.wrongCount,
    wrongTopics: r.wrongTopics ?? [],
    createdAt: r.createdAt,
  };
}

export function StudentResultDetail() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    meApi
      .getMyResults()
      .then((data) => {
        if (!cancelled) {
          const found = data.find((r) => r.id === id);
          setResult(found ? toExamResult(found) : null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Sonuç yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" dismissible onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-file-earmark-x fs-1 text-muted d-block mb-3" />
        <h5>Sonuç bulunamadı</h5>
        <Link to="/student">
          <Button variant="outline-primary">Sonuçlarıma dön</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/student"
          className="text-decoration-none text-muted small mb-2 d-inline-block"
        >
          <i className="bi bi-arrow-left me-1" /> Sonuçlarıma dön
        </Link>
        <h4 className="fw-bold mb-1">Sınav Sonucu Detayı</h4>
        <p className="text-muted mb-0">
          {new Date(result.createdAt).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white border-bottom py-3">
          <h6 className="fw-semibold mb-0">
            <i className="bi bi-clipboard-check me-2" />
            Özet
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-4">
            <div>
              <div className="text-muted small">Doğru</div>
              <div className="fs-4 fw-bold text-success">{result.correctCount}</div>
            </div>
            <div>
              <div className="text-muted small">Yanlış</div>
              <div className="fs-4 fw-bold text-danger">{result.wrongCount}</div>
            </div>
            <div>
              <div className="text-muted small">Toplam</div>
              <div className="fs-4 fw-bold">
                {result.correctCount + result.wrongCount}
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {result.wrongTopics && result.wrongTopics.length > 0 && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0">
              <i className="bi bi-exclamation-triangle me-2" />
              Zayıf Konular
            </h6>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Konu</th>
                  <th>Yanlış Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {result.wrongTopics.map((t, i) => (
                  <tr key={i}>
                    <td className="fw-medium">{t.topic}</td>
                    <td>{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
