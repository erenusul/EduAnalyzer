/**
 * Veli paneli - Bağlı öğrencilerin sınav sonuçları
 */

import { useEffect, useState } from 'react';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { meApi } from '../services/backendApi';
import type { StudentWithResults } from '../services/backendApi';

export function ParentDashboard() {
  const [children, setChildren] = useState<StudentWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    meApi
      .getMyChildren()
      .then((data) => {
        if (!cancelled) setChildren(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Veriler yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div>
      <h4 className="mb-4">Öğrencilerim</h4>
      {children.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center text-muted py-5">
            <i className="bi bi-people display-4 d-block mb-2" />
            Henüz bağlı öğrenciniz bulunmuyor.
          </Card.Body>
        </Card>
      ) : (
        <div className="d-flex flex-column gap-4">
          {children.map(({ student, results }) => (
            <Card key={student.id} className="border-0 shadow-sm">
              <Card.Header className="bg-white fw-semibold">
                {student.firstName} {student.lastName}
                {student.studentNo && (
                  <span className="text-muted ms-2">({student.studentNo})</span>
                )}
              </Card.Header>
              <Card.Body>
                {results.length === 0 ? (
                  <p className="text-muted mb-0">Henüz sınav sonucu yok.</p>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {results.map((r) => (
                      <div
                        key={r.id}
                        className="d-flex justify-content-between align-items-center py-2 border-bottom border-light"
                      >
                        <span className="badge bg-secondary">
                          {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                        <span>
                          Doğru: {r.correctCount} / Yanlış: {r.wrongCount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
