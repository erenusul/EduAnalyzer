/**
 * Veli paneli layout
 */

import { Outlet } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';

export function ParentLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="d-flex flex-column vh-100 bg-body-tertiary">
      <header
        className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom bg-white"
        style={{ minHeight: 60 }}
      >
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small">Veli Paneli</span>
        </div>
        <Dropdown align="end">
          <Dropdown.Toggle
            variant="light"
            className="d-flex align-items-center gap-2 border-0"
            id="parent-user-dropdown"
          >
            <div
              className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center"
              style={{ width: 32, height: 32 }}
            >
              <i className="bi bi-person-fill small" aria-hidden />
            </div>
            <span className="text-dark d-none d-sm-inline">{user?.displayName ?? user?.email}</span>
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
      <main className="flex-grow-1 overflow-auto p-4 bg-body">
        <div className="container-fluid" style={{ maxWidth: 900 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
