/**
 * Öğretmen paneli layout (sidebar + header + içerik)
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Alert, Button, Offcanvas, Spinner } from 'react-bootstrap';
import type { CSSProperties } from 'react';
import { Sidebar, TeacherSidebarNav } from './Sidebar';
import { Header } from './Header';
import { useTeacherData } from '../../contexts/TeacherDataContext';

const mobileSidebarStyle: CSSProperties = {
  backgroundColor: 'var(--eduanalyzer-sidebar-bg)',
  color: 'var(--eduanalyzer-sidebar-text)',
  maxWidth: 300,
};

export function TeacherLayout() {
  const { loading, error, clearError, refresh } = useTeacherData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="d-flex flex-column vh-100 bg-body-tertiary">
      <Header onOpenMobileNav={() => setMobileMenuOpen(true)} />
      {error && (
        <Alert variant="danger" dismissible onClose={clearError} className="m-3 mb-0">
          <i className="bi bi-exclamation-triangle me-2" />
          {error}
          <Button variant="outline-danger" size="sm" className="ms-2" onClick={() => refresh()}>
            Tekrar Dene
          </Button>
        </Alert>
      )}
      <div className="d-flex flex-grow-1 overflow-hidden position-relative">
        {loading && (
          <div
            className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center bg-white bg-opacity-50"
            style={{ zIndex: 10 }}
            aria-busy="true"
          >
            <Spinner animation="border" role="status" />
          </div>
        )}
        <aside className="d-none d-lg-flex flex-shrink-0 h-100 overflow-y-auto">
          <Sidebar />
        </aside>
        <Offcanvas
          show={mobileMenuOpen}
          onHide={() => setMobileMenuOpen(false)}
          placement="start"
          className="d-lg-none"
          style={mobileSidebarStyle}
          aria-labelledby="teacher-mobile-nav-title"
        >
          <Offcanvas.Header
            closeButton
            closeVariant="white"
            className="border-bottom border-white border-opacity-10 text-white"
            style={{ backgroundColor: 'var(--eduanalyzer-sidebar-bg)' }}
          >
            <Offcanvas.Title id="teacher-mobile-nav-title" className="text-white fs-6">
              Menü
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="p-0 d-flex flex-column flex-grow-1 overflow-y-auto">
            <div className="flex-grow-1 p-3" style={mobileSidebarStyle}>
              <TeacherSidebarNav onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </Offcanvas.Body>
        </Offcanvas>
        <main className="flex-grow-1 overflow-auto p-3 p-lg-4 bg-body min-w-0">
          <div className="container-fluid" style={{ maxWidth: 1200 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
