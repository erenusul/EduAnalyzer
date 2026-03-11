import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { SingleQuestionAnalysis } from './SingleQuestionAnalysis';

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));
vi.mock('../services/predictionApi', () => ({
  predictQuestion: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData() {
  vi.mocked(useTeacherData).mockReturnValue({
    addAnalysis: vi.fn(),
    students: [],
    classes: [],
    analyses: [],
    exams: [],
    examResults: [],
    loading: false,
    error: null,
    clearError: () => {},
    refresh: async () => {},
    addStudent: async () => ({} as never),
    updateStudent: async () => {},
    deleteStudent: async () => {},
    addClass: async () => ({} as never),
    updateClass: async () => {},
    deleteClass: async () => {},
    assignStudentToClass: async () => {},
    analyzePdf: async () => ({} as never),
    deleteAnalysis: async () => {},
    addExam: async () => ({} as never),
    updateExam: async () => {},
    getExamByAnalysisId: () => undefined,
    getResultsByExam: () => [],
    getResultsByStudent: () => [],
    getStudentsByClass: () => [],
    getClassById: () => undefined,
    getStudentById: () => undefined,
  } as never);
}

describe('SingleQuestionAnalysis', () => {
  it('renders form with question textarea', () => {
    mockTeacherData();
    render(
      <ToastProvider>
        <MemoryRouter>
          <SingleQuestionAnalysis />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Tek Soru Analizi')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/örnek: bu bilgiye göre/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /soru metnini analiz et/i })).toBeInTheDocument();
  });
});
