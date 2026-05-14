import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleProtectedRoute } from './RoleProtectedRoute';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const { useAuth } = await import('../contexts/AuthContext');

function renderWithRouter(authState: { isAuthenticated: boolean; user?: { role?: string } }) {
  vi.mocked(useAuth).mockReturnValue({
    ...authState,
    user: authState.user ? { id: '1', email: 'test@test.com', displayName: 'Test', role: authState.user.role as 'Teacher' | 'Student' | 'Parent' } : null,
    login: async () => null,
    loginDemo: async () => null,
    loginDemoParent: async () => null,
    logout: () => {},
  } as never);

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <RoleProtectedRoute role="Teacher">
              <div>Dashboard Content</div>
            </RoleProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/student" element={<div>Student Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoleProtectedRoute', () => {
  it('renders children when user has correct role', () => {
    renderWithRouter({ isAuthenticated: true, user: { role: 'Teacher' } });
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    renderWithRouter({ isAuthenticated: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('redirects to student path when user is Student and route requires Teacher', () => {
    renderWithRouter({ isAuthenticated: true, user: { role: 'Student' } });
    expect(screen.getByText('Student Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });
});
