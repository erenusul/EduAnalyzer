/**
 * Veli paneli sol menü
 */

import type { CSSProperties } from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/parent', label: 'Ana Sayfa', icon: 'bi-house-door' },
  { to: '/parent/cocuklar', label: 'Çocuklarım', icon: 'bi-people' },
  { to: '/parent/analysis', label: 'Gelişim Analizi', icon: 'bi-graph-up-arrow' },
  { to: '/parent/history', label: 'Sınav Geçmişi', icon: 'bi-clock-history' },
  { to: '/parent/reports', label: 'Raporlar', icon: 'bi-file-earmark-text' },
];

const sidebarNavStyle: CSSProperties = {
  backgroundColor: 'var(--eduanalyzer-sidebar-bg)',
  color: 'var(--eduanalyzer-sidebar-text)',
};

export type ParentSidebarNavProps = {
  onNavigate?: () => void;
};

export function ParentSidebarNav({ onNavigate }: ParentSidebarNavProps) {
  const location = useLocation();

  return (
    <>
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ marginTop: '-55px', marginBottom: '-55px' }}
      >
        <img
          src="/edulyzer_logo_beyaz.png"
          alt="EduAnalyzer Logo"
          style={{ width: '190px', height: 'auto', objectFit: 'contain' }}
        />
      </div>
      <Nav className="flex-column gap-1 mt-3" as="ul">
        {NAV_ITEMS.map((item) => {
          const isActive = (() => {
            if (item.to === '/parent') {
              return location.pathname === '/parent';
            }
            if (item.to === '/parent/cocuklar') {
              return (
                location.pathname === '/parent/cocuklar' ||
                location.pathname.startsWith('/parent/student')
              );
            }
            return location.pathname.startsWith(item.to);
          })();

          return (
            <Nav.Item as="li" key={item.label}>
              <Nav.Link
                as={Link}
                to={item.to}
                onClick={() => onNavigate?.()}
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
    </>
  );
}

export function ParentSidebar() {
  return (
    <nav
      className="d-flex flex-column p-3 h-100"
      style={{
        minWidth: 240,
        width: 240,
        ...sidebarNavStyle,
      }}
    >
      <ParentSidebarNav />
    </nav>
  );
}
