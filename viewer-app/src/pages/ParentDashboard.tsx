/**
 * Veli paneli - Bağlı öğrencilerin sınav sonuçları
 */

import { useEffect, useState } from 'react';
import { Spinner, Alert, Card, Container } from 'react-bootstrap';
import { meApi } from '../services/backendApi';
import type { StudentWithResults } from '../services/backendApi';
import { StudentSummaryCard } from '../components/parent/StudentSummaryCard';

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
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="primary" />
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
    <Container fluid className="px-0">
      <div className="mb-5">
        <h3 className="fw-bold text-dark mb-2">Öğrencilerim</h3>
        <p className="text-muted fs-6 mb-0">
          Çocuklarınızın güncel eğitim durumunu ve gelişim trendlerini buradan takip edebilirsiniz.
        </p>
      </div>

      {children.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center text-muted py-5 my-5">
            <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-people fs-1 text-secondary" />
            </div>
            <h5 className="text-dark fw-semibold">Henüz bağlı öğrenciniz bulunmuyor.</h5>
            <p className="mb-0">Kurumunuz tarafından yapılan atamalar burada listelenecektir.</p>
          </Card.Body>
        </Card>
      ) : (
        <div className="row g-4 row-cols-1 row-cols-md-2 row-cols-xl-3">
          {children.map((childData) => (
            <div className="col" key={childData.student.id}>
              <StudentSummaryCard data={childData} />
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
