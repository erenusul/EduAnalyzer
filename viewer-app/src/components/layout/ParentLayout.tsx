/**
 * Veli paneli layout
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { Button, Dropdown, Offcanvas } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { ParentSidebar, ParentSidebarNav } from './ParentSidebar';

const mobileSidebarStyle: CSSProperties = {
  backgroundColor: 'var(--eduanalyzer-sidebar-bg)',
  color: 'var(--eduanalyzer-sidebar-text)',
  maxWidth: 300,
};

export function ParentLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="d-flex flex-column vh-100 bg-body-tertiary">
      <header
        className="d-flex align-items-center justify-content-between px-3 px-lg-4 py-3 border-bottom bg-white"
        style={{ minHeight: 60 }}
      >
        <div className="d-flex align-items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="light"
            className="border d-lg-none p-2 flex-shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <i className="bi bi-list fs-4 lh-1 d-block" aria-hidden />
          </Button>
          <span className="text-muted small text-truncate">Veli Paneli</span>
        </div>
        <Dropdown align="end">
          <Dropdown.Toggle
            variant="light"
            className="d-flex align-items-center gap-2 border-0 flex-shrink-0"
            id="parent-user-dropdown"
          >
            <div
              className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center"
              style={{ width: 32, height: 32 }}
            >
              <i className="bi bi-person-fill small" aria-hidden />
            </div>
            <span className="text-dark d-none d-sm-inline text-truncate" style={{ maxWidth: 160 }}>
              {user?.displayName ?? user?.email}
            </span>
            <i className="bi bi-chevron-down small text-muted" aria-hidden />
          </Dropdown.Toggle>
          <Dropdown.Menu align="end" className="shadow-sm">
            <Dropdown.Header>
              <small className="text-muted">Giriş yapan</small>
              <div className="fw-semibold">{user?.displayName ?? user?.email}</div>
            </Dropdown.Header>
            <Dropdown.Divider />
            <Dropdown.Item onClick={logout} className="text-danger">
              <i className="bi bi-box-arrow-right me-2" />
              Çıkış Yap
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </header>
      <div className="d-flex flex-grow-1 overflow-hidden position-relative">
        <aside className="d-none d-lg-flex flex-shrink-0 h-100 overflow-y-auto">
          <ParentSidebar />
        </aside>
        <Offcanvas
          show={mobileMenuOpen}
          onHide={() => setMobileMenuOpen(false)}
          placement="start"
          className="d-lg-none"
          style={mobileSidebarStyle}
          aria-labelledby="parent-mobile-nav-title"
        >
          <Offcanvas.Header
            closeButton
            closeVariant="white"
            className="border-bottom border-white border-opacity-10 text-white"
            style={{ backgroundColor: 'var(--eduanalyzer-sidebar-bg)' }}
          >
            <Offcanvas.Title id="parent-mobile-nav-title" className="text-white fs-6">
              Menü
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="p-0 d-flex flex-column flex-grow-1 overflow-y-auto">
            <div className="flex-grow-1 p-3" style={mobileSidebarStyle}>
              <ParentSidebarNav onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </Offcanvas.Body>
        </Offcanvas>
        <main className="flex-grow-1 overflow-auto p-3 p-lg-4 bg-body min-w-0">
          <div className="container-fluid" style={{ maxWidth: 1100 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
