import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { CreatedExams } from './CreatedExams';

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData(exams: unknown[] = [], analyses: unknown[] = []) {
  vi.mocked(useTeacherData).mockReturnValue({
    exams,
    analyses,
    refresh: vi.fn(),
    loading: false,
    students: [],
    classes: [],
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
    deleteAnalysis: async () => {},
    addExam: async () => ({} as never),
    updateExam: async () => {},
    getExamByAnalysisId: () => undefined,
    getResultsByExam: () => [],
    getResultsByStudent: () => [],
    getStudentsByClass: () => [],
    getClassById: () => undefined,
    getStudentById: () => undefined,
    addExamResult: async () => ({} as never),
  } as never);
}

describe('CreatedExams', () => {
  it('renders empty state when no exams', () => {
    mockTeacherData([], []);
    render(
      <ToastProvider>
        <MemoryRouter>
          <CreatedExams />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Oluşturulan Sınavlar')).toBeInTheDocument();
    expect(screen.getByText(/henüz sınav oluşturulmamış/i)).toBeInTheDocument();
  });

  it('renders exam list when exams exist', () => {
    mockTeacherData(
      [
        {
          id: '1',
          analysisId: 'a1',
          title: 'Deneme 1',
          weekLabel: '2025-W01',
          createdAt: '2025-01-15T10:00:00Z',
          status: 'ready',
        },
      ] as never[],
      [{ id: 'a1', analyzedQuestions: 20 }] as never[]
    );
    render(
      <ToastProvider>
        <MemoryRouter>
          <CreatedExams />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Deneme 1')).toBeInTheDocument();
    expect(screen.getByText('2025-W01')).toBeInTheDocument();
  });
});
