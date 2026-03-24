import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { AnalysisHistory } from './AnalysisHistory';

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData(analyses: unknown[] = []) {
  vi.mocked(useTeacherData).mockReturnValue({
    analyses,
    deleteAnalysis: vi.fn(),
    getExamByAnalysisId: () => undefined,
    refresh: vi.fn(),
    loading: false,
    students: [],
    classes: [],
    exams: [],
    examResults: [],
    error: null,
    clearError: () => {},
    addStudent: async () => ({} as never),
    updateStudent: async () => {},
    deleteStudent: async () => {},
    addClass: async () => ({} as never),
    updateClass: async () => {},
    deleteClass: async () => {},
    assignStudentToClass: async () => {},
    analyzePdf: async () => ({} as never),
    addAnalysis: async () => ({} as never),
    addExam: async () => ({} as never),
    addExamResult: async () => ({} as never),
    updateExamResult: async () => ({} as never),
    deleteExamResult: async () => {},
    getResultsByExam: () => [],
    getResultsByStudent: () => [],
    getStudentsByClass: () => [],
    getClassById: () => undefined,
    getStudentById: () => undefined,
  } as never);
}

describe('AnalysisHistory', () => {
  it('renders empty state when no analyses', () => {
    mockTeacherData([]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <AnalysisHistory />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Analiz Geçmişi')).toBeInTheDocument();
    expect(screen.getByText(/henüz analiz yapılmamış/i)).toBeInTheDocument();
  });

  it('renders list when analyses exist', () => {
    mockTeacherData([
      {
        id: '1',
        title: 'Deneme 1',
        type: 'pdf',
        analyzedQuestions: 20,
        totalQuestions: 20,
        date: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-15T10:00:00Z',
      },
    ] as never[]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <AnalysisHistory />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Deneme 1')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });
});
