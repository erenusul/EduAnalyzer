/**
 * Öğretmen dashboard ana sayfa
 */

import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTeacherData } from '../contexts/TeacherDataContext';

const FEATURE_CARDS = [
  {
    to: '/dashboard/ogrenci-takibi',
    title: 'Öğrenci Takibi',
    description: 'Öğrencilerinizi listeleyin, arayın ve detaylı takip edin.',
    icon: 'bi-people',
    iconClass: 'bg-primary bg-opacity-10 text-primary',
  },
  {
    to: '/dashboard/sinav-analizi',
    title: "PDF'den Sınav Analizi",
    description: 'PDF dosyası yükleyerek tüm soruların ders ve konu tahminlerini alın.',
    icon: 'bi-file-earmark-pdf',
    iconClass: 'bg-success bg-opacity-10 text-success',
  },
  {
    to: '/dashboard/tek-soru',
    title: 'Tek Soru Analizi',
    description: 'Tek bir soru metnini yapıştırarak ders ve konu tahmini alın.',
    icon: 'bi-chat-quote',
    iconClass: 'bg-info bg-opacity-10 text-info',
  },
  {
    to: '/dashboard/siniflar',
    title: 'Sınıf Yönetimi',
    description: 'Sınıflarınızı oluşturun ve öğrencileri atayın.',
    icon: 'bi-collection',
    iconClass: 'bg-warning bg-opacity-10 text-warning',
  },
  {
    to: '/dashboard/analiz-gecmisi',
    title: 'Analiz Geçmişi',
    description: 'Yapılan analizlerin geçmişine göz atın.',
    icon: 'bi-clock-history',
    iconClass: 'bg-secondary bg-opacity-10 text-secondary',
  },
  {
    to: '/dashboard/raporlar',
    title: 'Raporlar',
    description: 'Genel istatistikler ve özet bilgiler.',
    icon: 'bi-graph-up',
    iconClass: 'bg-danger bg-opacity-10 text-danger',
  },
] as const;

export function TeacherDashboard() {
  const { user } = useAuth();
  const { students, classes, analyses } = useTeacherData();

  const totalQuestions = analyses.reduce((sum, a) => sum + a.analyzedQuestions, 0);

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Hoş geldiniz, {user?.displayName}</h4>
        <p className="text-muted mb-0">
          Sınav analizi ve öğrenci takip araçlarına aşağıdan ulaşabilirsiniz.
        </p>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-3">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-people text-primary fs-4" />
                <div>
                  <div className="fw-bold">{students.length}</div>
                  <div className="small text-muted">Öğrenci</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-6 col-md-3">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-3">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-collection text-success fs-4" />
                <div>
                  <div className="fw-bold">{classes.length}</div>
                  <div className="small text-muted">Sınıf</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-6 col-md-3">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-3">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-file-earmark-bar-graph text-info fs-4" />
                <div>
                  <div className="fw-bold">{analyses.length}</div>
                  <div className="small text-muted">Analiz</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-6 col-md-3">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-3">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-question-circle text-warning fs-4" />
                <div>
                  <div className="fw-bold">{totalQuestions}</div>
                  <div className="small text-muted">Soru</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <h5 className="fw-semibold mb-3">Özellikler</h5>
      <div className="row g-3">
        {FEATURE_CARDS.map((card) => (
          <div key={card.to} className="col-md-6 col-lg-4">
            <Card
              as={Link}
              to={card.to}
              className="text-decoration-none text-dark border-0 shadow-sm card-hover h-100"
            >
              <Card.Body className="p-4">
                <div
                  className={`d-inline-flex align-items-center justify-content-center rounded-3 ${card.iconClass} mb-3`}
                  style={{ width: 48, height: 48 }}
                >
                  <i className={`bi ${card.icon} fs-4`} aria-hidden />
                </div>
                <Card.Title as="h6" className="fw-semibold mb-2">
                  {card.title}
                </Card.Title>
                <Card.Text className="text-muted mb-0 small">{card.description}</Card.Text>
                <div className="mt-3 text-primary small fw-medium">
                  Git <i className="bi bi-arrow-right ms-1" />
                </div>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
