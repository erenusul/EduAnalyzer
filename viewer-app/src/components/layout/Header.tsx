/**
 * Öğretmen paneli üst başlık
 */

import { Button, Dropdown } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';

export type HeaderProps = {
  /** lg altında sol menüyü açar */
  onOpenMobileNav?: () => void;
};

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header
      className="d-flex align-items-center justify-content-between px-3 px-lg-4 py-3 border-bottom bg-white"
      style={{ minHeight: 60 }}
    >
      <div className="d-flex align-items-center gap-2 min-w-0">
        {onOpenMobileNav && (
          <Button
            type="button"
            variant="light"
            className="border d-lg-none p-2 flex-shrink-0"
            onClick={onOpenMobileNav}
            aria-label="Menüyü aç"
          >
            <i className="bi bi-list fs-4 lh-1 d-block" aria-hidden />
          </Button>
        )}
        <span className="text-muted small d-none d-md-inline text-truncate">Öğretmen Paneli</span>
      </div>
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="light"
          className="d-flex align-items-center gap-2 border-0 flex-shrink-0"
          id="user-dropdown"
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
  );
}
