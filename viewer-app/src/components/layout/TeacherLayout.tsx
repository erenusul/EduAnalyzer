/**
 * Öğretmen paneli layout (sidebar + header + içerik)
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function TeacherLayout() {
  return (
    <div className="d-flex flex-column vh-100 bg-body-tertiary">
      <Header />
      <div className="d-flex flex-grow-1 overflow-hidden">
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
