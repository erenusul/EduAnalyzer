/**
 * Öğretmen paneli sol menü
 */

import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Ana Sayfa', icon: 'bi-house-door' },
  { to: '/dashboard/ogrenci-takibi', label: 'Öğrenci Takibi', icon: 'bi-people' },
  { to: '/dashboard/sinav-analizi', label: 'PDF Sınav Analizi', icon: 'bi-file-earmark-pdf' },
  { to: '/dashboard/tek-soru', label: 'Tek Soru Analizi', icon: 'bi-chat-quote' },
  { to: '/dashboard/siniflar', label: 'Sınıf Yönetimi', icon: 'bi-collection' },
  { to: '/dashboard/sinif-analizi', label: 'Sınıf Analizi', icon: 'bi-bar-chart' },
  { to: '/dashboard/analiz-gecmisi', label: 'Analiz Geçmişi', icon: 'bi-clock-history' },
  { to: '/dashboard/olusturulan-sinavlar', label: 'Oluşturulan Sınavlar', icon: 'bi-file-earmark-text' },
  { to: '/dashboard/raporlar', label: 'Raporlar', icon: 'bi-graph-up' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <nav
      className="d-flex flex-column p-3"
      style={{
        minWidth: 240,
        backgroundColor: 'var(--eduanalyzer-sidebar-bg)',
        color: 'var(--eduanalyzer-sidebar-text)',
      }}
    >
      <div className="d-flex align-items-center gap-2 mb-4 px-2">
        <i className="bi bi-mortarboard-fill fs-4 text-white" aria-hidden />
        <span className="fw-semibold text-white">EduAnalyzer</span>
      </div>
      <Nav className="flex-column gap-1" as="ul">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'));
          return (
            <Nav.Item as="li" key={item.to}>
              <Nav.Link
                as={Link}
                to={item.to}
                className={`d-flex align-items-center gap-3 rounded-2 px-3 py-2 text-decoration-none ${
                  isActive ? 'bg-primary text-white' : 'text-white-50 sidebar-nav-link'
                }`}
              >
                <i className={`bi ${item.icon} fs-5`} aria-hidden />
                <span>{item.label}</span>
              </Nav.Link>
            </Nav.Item>
          );
        })}
      </Nav>
    </nav>
  );
}
