/**
 * Öğretmen paneli layout (sidebar + header + içerik)
 */

import { Outlet } from 'react-router-dom';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useTeacherData } from '../../contexts/TeacherDataContext';

export function TeacherLayout() {
  const { loading, error, clearError, refresh } = useTeacherData();

  return (
    <div className="d-flex flex-column vh-100 bg-body-tertiary">
      <Header />
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
        <Sidebar />
        <main className="flex-grow-1 overflow-auto p-4 bg-body">
          <div className="container-fluid" style={{ maxWidth: 1200 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
