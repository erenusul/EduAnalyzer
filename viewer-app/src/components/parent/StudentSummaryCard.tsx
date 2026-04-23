import { Link } from 'react-router-dom';
import { Card, Row, Col, Badge } from 'react-bootstrap';
import type { StudentWithResults } from '../../services/backendApi';
import { mappers } from '../../services/backendApi';
import {
  buildParentInsights,
  lgsNet,
  sortResultsByDateDesc,
  successPct,
} from '../../utils/parentResultUtils';

interface Props {
  data: StudentWithResults;
}

export function StudentSummaryCard({ data: { student, results: rawResults } }: Props) {
  const mapped = sortResultsByDateDesc(rawResults.map(mappers.toExamResult));
  const latest = mapped[0];
  const previous = mapped[1];
  const insights = buildParentInsights(mapped);

  const netLatest = latest ? lgsNet(latest) : null;
  const pctLatest = latest ? successPct(latest) : null;
  const netPrev = previous ? lgsNet(previous) : null;

  const initial = (student.firstName?.[0] || '') + (student.lastName?.[0] || '');

  return (
    <Card className="border-0 shadow-sm h-100 position-relative overflow-hidden">
      <Card.Body className="p-4 p-lg-5 d-flex flex-column">
        {/* Header: Avatar and Name */}
        <div className="d-flex align-items-center mb-4 pb-3 border-bottom">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle bg-light text-primary fw-bold fs-4 me-3"
            style={{ width: '56px', height: '56px', flexShrink: 0 }}
          >
            {initial.toUpperCase()}
          </div>
          <div className="flex-grow-1">
            <h5 className="mb-1 fw-bold text-dark">
              {student.firstName} {student.lastName}
            </h5>
            <div className="text-muted small">
              {student.studentNo ? `No: ${student.studentNo}` : 'Kayıtlı Öğrenci'}
            </div>
          </div>
          {mapped.length > 0 && (
            <Badge bg="light" text="secondary" className="fw-normal border">
              {mapped.length} Sınav
            </Badge>
          )}
        </div>

        {/* Content */}
        {latest ? (
          <div className="flex-grow-1 d-flex flex-column">
            <div className="text-center mb-4">
              <div className="text-muted small fw-medium text-uppercase mb-2" style={{ letterSpacing: '0.05em' }}>
                Son Sınav Neti
              </div>
              <div className="d-flex justify-content-center align-items-end gap-2">
                <span className="display-4 fw-bolder text-dark lh-1">{netLatest}</span>
                {mapped.length >= 2 && netPrev != null && netLatest != null && (
                  <span
                    className={`fs-5 fw-bold mb-1 ${
                      netLatest >= netPrev ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {netLatest >= netPrev ? (
                      <i className="bi bi-arrow-up-right me-1" />
                    ) : (
                      <i className="bi bi-arrow-down-right me-1" />
                    )}
                    {Math.abs(netLatest - netPrev).toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Mini Metrics Row */}
            <div className="bg-light rounded-3 p-3 mb-4 border">
              <Row className="g-0 text-center">
                <Col xs={4} className="border-end">
                  <div className="text-muted small mb-1">Doğru</div>
                  <div className="fw-bold fs-5 text-success">{latest.correctCount}</div>
                </Col>
                <Col xs={4} className="border-end">
                  <div className="text-muted small mb-1">Yanlış</div>
                  <div className="fw-bold fs-5 text-danger">{latest.wrongCount}</div>
                </Col>
                <Col xs={4}>
                  <div className="text-muted small mb-1">Başarı</div>
                  <div className="fw-bold fs-5 text-primary">%{pctLatest}</div>
                </Col>
              </Row>
            </div>

            {/* Context & Insights */}
            <div className="mt-auto">
              <div className="d-flex align-items-start mb-2">
                <i className="bi bi-calendar-check text-muted mt-1 me-2" />
                <div>
                  <div className="fw-semibold text-dark fs-6">
                    {latest.examTitle?.trim() || 'Son Sınav'}
                  </div>
                  <div className="text-muted small">
                    {new Date(latest.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {insights.hardestTopic && (
                <div className="d-flex align-items-start mb-2 mt-3 p-2 bg-danger bg-opacity-10 rounded border border-danger border-opacity-25">
                  <i className="bi bi-exclamation-circle text-danger mt-1 me-2" />
                  <div className="small text-danger">
                    <span className="fw-semibold">Önerilen Konu:</span> {insights.hardestTopic}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-muted py-4">
            <i className="bi bi-journal-x fs-1 mb-3 opacity-50" />
            <p className="mb-0">Henüz sınav sonucu bulunmuyor.</p>
          </div>
        )}

        {/* Footer Action */}
        <div className="mt-4 pt-3 border-top">
          <Link
            to={`/parent/student/${student.id}`}
            className="btn btn-light w-100 fw-semibold text-primary border"
          >
            Detaylı Gelişim Raporu <i className="bi bi-chevron-right ms-1 small" />
          </Link>
        </div>
      </Card.Body>
    </Card>
  );
}
