import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { StudentDetail } from './StudentDetail';

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData(student: unknown = null) {
  const getStudentById = vi.fn(() => student);
  vi.mocked(useTeacherData).mockReturnValue({
    getStudentById,
    getClassById: () => undefined,
    classes: [],
    updateStudent: vi.fn(),
    assignStudentToClass: vi.fn(),
    exams: [],
    getResultsByStudent: () => [],
    students: [],
    analyses: [],
    examResults: [],
    loading: false,
    error: null,
    clearError: () => {},
    refresh: async () => {},
    addStudent: async () => ({} as never),
    deleteStudent: async () => {},
    addClass: async () => ({} as never),
    updateClass: async () => {},
    deleteClass: async () => {},
    analyzePdf: async () => ({} as never),
    addAnalysis: async () => ({} as never),
    deleteAnalysis: async () => {},
    addExam: async () => ({} as never),
    updateExam: async () => {},
    getExamByAnalysisId: () => undefined,
    getResultsByExam: () => [],
    getStudentsByClass: () => [],
  } as never);
}

describe('StudentDetail', () => {
  it('shows not found when student does not exist', () => {
    mockTeacherData(null);
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard/ogrenci/nonexistent']}>
          <Routes>
            <Route path="/dashboard/ogrenci/:id" element={<StudentDetail />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText(/öğrenci bulunamadı/i)).toBeInTheDocument();
  });

  it('renders student info when student exists', () => {
    mockTeacherData({
      id: '1',
      studentNo: '1001',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      classId: null,
      email: null,
      phone: null,
      notes: null,
      createdAt: '',
    });
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard/ogrenci/1']}>
          <Routes>
            <Route path="/dashboard/ogrenci/:id" element={<StudentDetail />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText(/ahmet yılmaz/i)).toBeInTheDocument();
    expect(screen.getByText(/1001/)).toBeInTheDocument();
  });
});
