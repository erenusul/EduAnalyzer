import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Container, Spinner } from 'react-bootstrap';
import { meApi, mappers } from '../services/backendApi';
import type { StudentWithResults } from '../services/backendApi';
import type { ExamResult } from '../types/teacher';
import { sortResultsByDateDesc } from '../utils/parentResultUtils';
import { StudentPerformanceInsightsPanel } from '../components/student/StudentPerformanceInsightsPanel';

export function ChildDetail() {
  const { id } = useParams<{ id: string }>();
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
        if (!cancelled) setError(err?.message ?? 'Öğrenci detayı yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const child = useMemo(() => children.find((x) => x.student.id === id), [children, id]);
  const results = useMemo<ExamResult[]>(
    () => (child ? sortResultsByDateDesc(child.results.map(mappers.toExamResult)) : []),
    [child]
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error || (!child && !loading)) {
    return (
      <Container fluid className="px-0 py-5">
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error || 'Öğrenci bulunamadı.'}
        </Alert>
        <Link to="/parent" className="btn btn-outline-primary mt-2">
          Veli paneline dön
        </Link>
      </Container>
    );
  }

  if (!child) return null;

  return (
    <Container fluid className="px-0 pb-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 mb-lg-5 gap-3">
        <div className="min-w-0 w-100">
          <Link
            to="/parent"
            className="text-decoration-none text-muted small d-inline-flex align-items-center mb-2 transition-hover"
          >
            <i className="bi bi-arrow-left me-1" />
            Öğrencilerime Dön
          </Link>
          <div className="d-flex align-items-center">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold fs-3 me-3 shadow-sm flex-shrink-0"
              style={{ width: '50px', height: '50px' }}
            >
              {(child.student.firstName?.[0] || '').toUpperCase()}
              {(child.student.lastName?.[0] || '').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="fw-bold mb-0 text-dark text-break">
                {child.student.firstName} {child.student.lastName}
              </h2>
              <div className="text-muted fs-6">No: {child.student.studentNo || 'Kayıtlı Öğrenci'}</div>
            </div>
          </div>
        </div>
      </div>

      <StudentPerformanceInsightsPanel results={results} />
    </Container>
  );
}
