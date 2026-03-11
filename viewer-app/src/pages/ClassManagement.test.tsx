import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { ClassManagement } from './ClassManagement';

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData(classes: unknown[] = []) {
  vi.mocked(useTeacherData).mockReturnValue({
    classes,
    getStudentsByClass: () => [],
    addClass: vi.fn(),
    deleteClass: vi.fn(),
    students: [],
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
    addAnalysis: async () => ({} as never),
    deleteAnalysis: async () => {},
    addExam: async () => ({} as never),
    getResultsByExam: () => [],
    getResultsByStudent: () => [],
    getClassById: () => undefined,
    getStudentById: () => undefined,
  } as never);
}

describe('ClassManagement', () => {
  it('renders empty state when no classes', () => {
    mockTeacherData([]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <ClassManagement />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Sınıf Yönetimi')).toBeInTheDocument();
    expect(screen.getByText(/henüz sınıf yok/i)).toBeInTheDocument();
  });

  it('renders class list when classes exist', () => {
    mockTeacherData([
      {
        id: '1',
        name: '8-A',
        grade: 8,
        academicYear: '2024-2025',
        studentIds: [],
        createdAt: '',
      },
    ] as never[]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <ClassManagement />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('8-A')).toBeInTheDocument();
  });
});
