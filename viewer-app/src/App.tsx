import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TeacherDataProvider } from './contexts/TeacherDataContext';
import { ToastProvider } from './contexts/ToastContext';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { TeacherLayout } from './components/layout/TeacherLayout';
import { StudentLayout } from './components/layout/StudentLayout';
import { ParentLayout } from './components/layout/ParentLayout';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { StudentResultDetail } from './pages/StudentResultDetail';
import { ParentDashboard } from './pages/ParentDashboard';
import { StudentTracking } from './pages/StudentTracking';
import { StudentDetail } from './pages/StudentDetail';
import { PdfExamAnalysis } from './pages/PdfExamAnalysis';
import { SingleQuestionAnalysis } from './pages/SingleQuestionAnalysis';
import { ClassManagement } from './pages/ClassManagement';
import { AnalysisHistory } from './pages/AnalysisHistory';
import { AnalysisDetail } from './pages/AnalysisDetail';
import { CreatedExams } from './pages/CreatedExams';
import { OpticScan } from './pages/OpticScan';
import { ClassAnalysis } from './pages/ClassAnalysis';
import { Reports } from './pages/Reports';
import './App.css';

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const path =
    user?.role === 'Teacher'
      ? '/dashboard'
      : user?.role === 'Student'
        ? '/student'
        : user?.role === 'Parent'
          ? '/parent'
          : '/dashboard';
  return <Navigate to={path} replace />;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <TeacherDataProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <RoleProtectedRoute role="Teacher">
                  <TeacherLayout />
                </RoleProtectedRoute>
              }
            >
              <Route index element={<TeacherDashboard />} />
              <Route path="ogrenci-takibi" element={<StudentTracking />} />
              <Route path="ogrenci/:id" element={<StudentDetail />} />
              <Route path="sinav-analizi" element={<PdfExamAnalysis />} />
              <Route path="tek-soru" element={<SingleQuestionAnalysis />} />
              <Route path="siniflar" element={<ClassManagement />} />
              <Route path="analiz-gecmisi" element={<AnalysisHistory />} />
              <Route path="analiz-gecmisi/:id" element={<AnalysisDetail />} />
              <Route path="olusturulan-sinavlar" element={<CreatedExams />} />
              <Route path="optik-tarama" element={<OpticScan />} />
              <Route path="sinif-analizi" element={<ClassAnalysis />} />
              <Route path="raporlar" element={<Reports />} />
            </Route>
            <Route
              path="student"
              element={
                <RoleProtectedRoute role="Student">
                  <StudentLayout />
                </RoleProtectedRoute>
              }
            >
              <Route index element={<StudentDashboard />} />
              <Route path="sonuc/:id" element={<StudentResultDetail />} />
            </Route>
            <Route
              path="parent"
              element={
                <RoleProtectedRoute role="Parent">
                  <ParentLayout />
                </RoleProtectedRoute>
              }
            >
              <Route index element={<ParentDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </TeacherDataProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
