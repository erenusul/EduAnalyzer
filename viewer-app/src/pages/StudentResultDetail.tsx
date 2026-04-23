/**
 * Öğrenci sonuç detay sayfası - tek sınav sonucu, konu dağılımı ve soru listesi
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Button, Table, Spinner, Alert } from 'react-bootstrap';
import { meApi, mappers } from '../services/backendApi';
import type { ExamResult, WrongQuestion } from '../types/teacher';

function sortQuestions(list: WrongQuestion[] | undefined): WrongQuestion[] {
  if (!list?.length) return [];
  return [...list].sort((a, b) => a.questionIndex - b.questionIndex);
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
          setResult(found ? mappers.toExamResult(found) : null);
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

  const correctSorted = useMemo(
    () => sortQuestions(result?.correctQuestions),
    [result?.correctQuestions]
  );
  const wrongSorted = useMemo(() => sortQuestions(result?.wrongQuestions), [result?.wrongQuestions]);

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

  const total = result.correctCount + result.wrongCount;
  const net = total > 0 ? result.correctCount - result.wrongCount / 4 : 0;
  const basariPct = total > 0 ? Math.round((result.correctCount / total) * 1000) / 10 : 0;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/student"
          className="text-decoration-none text-muted small mb-2 d-inline-block"
        >
          <i className="bi bi-arrow-left me-1" /> Sonuçlarıma dön
        </Link>
        <h4 className="fw-bold mb-1">{result.examTitle ?? 'Sınav Sonucu Detayı'}</h4>
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
              <div className="fs-4 fw-bold">{total}</div>
            </div>
            <div>
              <div className="text-muted small">Başarı</div>
              <div className="fs-4 fw-bold text-primary">{basariPct}%</div>
            </div>
            <div>
              <div className="text-muted small">Net (Türkçe/LGS)</div>
              <div className="fs-4 fw-bold text-info">{Math.round(net * 10) / 10}</div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {result.wrongTopics && result.wrongTopics.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
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

      {correctSorted.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0 text-success">
              <i className="bi bi-check2-circle me-2" />
              Doğru sorular ({correctSorted.length})
            </h6>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 110 }}>#</th>
                  <th>Öğrencinin cevabı</th>
                  <th>Doğru cevap</th>
                  <th>Konu</th>
                </tr>
              </thead>
              <tbody>
                {correctSorted.map((q) => (
                  <tr key={`c-${q.questionIndex}`}>
                    <td className="fw-semibold">{q.questionIndex}</td>
                    <td>{q.studentAnswer?.trim() || '—'}</td>
                    <td className="text-success fw-medium">
                      {q.expectedAnswer?.trim() || q.studentAnswer?.trim() || '—'}
                    </td>
                    <td>{q.topic}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {wrongSorted.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white border-bottom py-3">
            <h6 className="fw-semibold mb-0 text-danger">
              <i className="bi bi-x-circle me-2" />
              Yanlış sorular ({wrongSorted.length})
            </h6>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 110 }}>#</th>
                  <th>Öğrencinin cevabı</th>
                  <th>Doğru cevap</th>
                  <th>Konu</th>
                </tr>
              </thead>
              <tbody>
                {wrongSorted.map((q) => (
                  <tr key={`w-${q.questionIndex}`}>
                    <td className="fw-semibold">{q.questionIndex}</td>
                    <td>{q.studentAnswer?.trim() || '(boş)'}</td>
                    <td className="fw-medium text-success">
                      {q.expectedAnswer?.trim() || '—'}
                    </td>
                    <td>{q.topic}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {correctSorted.length === 0 && wrongSorted.length === 0 && (
        <Card className="border-0 shadow-sm bg-body-tertiary">
          <Card.Body className="text-muted small py-4">
            Bu sınav için soru bazlı detay listelenmiyor (eski kayıt veya özet kayıt).
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
