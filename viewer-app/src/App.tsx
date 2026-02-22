import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TeacherDataProvider } from './contexts/TeacherDataContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { TeacherLayout } from './components/layout/TeacherLayout';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { StudentTracking } from './pages/StudentTracking';
import { StudentDetail } from './pages/StudentDetail';
import { PdfExamAnalysis } from './pages/PdfExamAnalysis';
import { SingleQuestionAnalysis } from './pages/SingleQuestionAnalysis';
import { ClassManagement } from './pages/ClassManagement';
import { AnalysisHistory } from './pages/AnalysisHistory';
import { AnalysisDetail } from './pages/AnalysisDetail';
import { ClassAnalysis } from './pages/ClassAnalysis';
import { Reports } from './pages/Reports';
import './App.css';

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <TeacherDataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <TeacherLayout />
                </ProtectedRoute>
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
              <Route path="sinif-analizi" element={<ClassAnalysis />} />
              <Route path="raporlar" element={<Reports />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TeacherDataProvider>
    </AuthProvider>
  );
}

export default App;
