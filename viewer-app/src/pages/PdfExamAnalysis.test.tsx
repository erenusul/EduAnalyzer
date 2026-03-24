import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { PdfExamAnalysis } from './PdfExamAnalysis';

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData() {
  vi.mocked(useTeacherData).mockReturnValue({
    analyzePdf: vi.fn(),
    updateAnalysis: vi.fn(),
    getExamByAnalysisId: () => undefined,
    addExam: vi.fn(),
    analyses: [],
    students: [],
    classes: [],
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
    addAnalysis: async () => ({} as never),
    deleteAnalysis: async () => {},
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

describe('PdfExamAnalysis', () => {
  it('renders page title and upload zone', () => {
    mockTeacherData();
    render(
      <ToastProvider>
        <MemoryRouter>
          <PdfExamAnalysis />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText(/sınav analizi/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pdf dosyası yüklemek için/i)).toBeInTheDocument();
  });

  it('shows error when non-PDF file selected', async () => {
    mockTeacherData();
    render(
      <ToastProvider>
        <MemoryRouter>
          <PdfExamAnalysis />
        </MemoryRouter>
      </ToastProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput!, 'files', { value: [file], writable: false });
    fireEvent.change(fileInput!);

    expect(await screen.findByText(/lütfen sadece pdf dosyası seçiniz/i)).toBeInTheDocument();
  });
});
