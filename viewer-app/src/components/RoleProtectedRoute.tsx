/**
 * Belirli role sahip kullanıcılar için korumalı rota
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';
import type { UserRole } from '../types/auth';

interface RoleProtectedRouteProps {
  children: ReactNode;
  role: UserRole;
}

export function RoleProtectedRoute({ children, role }: RoleProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role && user.role !== role) {
    const defaultPath =
      user.role === 'Teacher'
        ? '/dashboard'
        : user.role === 'Student'
          ? '/student'
          : user.role === 'Parent'
            ? '/parent'
            : '/dashboard';
    return <Navigate to={defaultPath} replace />;
  }

  return <>{children}</>;
}
