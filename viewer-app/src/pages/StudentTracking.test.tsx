import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../contexts/ToastContext';
import { StudentTracking } from './StudentTracking';

const mockStudents = [
  {
    id: '1',
    studentNo: '1001',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    classId: null,
    email: 'ahmet@test.com',
    createdAt: '2025-01-01',
  },
  {
    id: '2',
    studentNo: '1002',
    firstName: 'Mehmet',
    lastName: 'Demir',
    classId: null,
    email: null,
    createdAt: '2025-01-01',
  },
];

const mockClasses = [
  { id: 'c1', name: '9-A', grade: 9, academicYear: '2024-25', studentIds: [], createdAt: '' },
];

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData(students = mockStudents) {
  vi.mocked(useTeacherData).mockReturnValue({
    students,
    classes: mockClasses,
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
    addAnalysis: async () => ({} as never),
    updateAnalysis: async () => {},
    deleteAnalysis: async () => {},
    addExam: async () => ({} as never),
    updateExam: async () => {},
    getExamByAnalysisId: () => undefined,
    getResultsByExam: () => [],
    getResultsByStudent: () => [],
    addExamResult: async () => ({} as never),
    updateExamResult: async () => ({} as never),
    deleteExamResult: async () => {},
    getStudentsByClass: () => [],
    getClassById: () => mockClasses[0],
    getStudentById: () => undefined,
  } as never);
}

describe('StudentTracking', () => {
  it('renders search input and list', () => {
    mockTeacherData();
    render(
      <ToastProvider>
        <MemoryRouter>
          <StudentTracking />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByPlaceholderText(/ad, soyad veya numara ile ara/i)).toBeInTheDocument();
    expect(screen.getByText('Ahmet Yılmaz')).toBeInTheDocument();
    expect(screen.getByText('Mehmet Demir')).toBeInTheDocument();
  });

  it('filters students by search', async () => {
    mockTeacherData();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <MemoryRouter>
          <StudentTracking />
        </MemoryRouter>
      </ToastProvider>
    );

    const searchInput = screen.getByPlaceholderText(/ad, soyad veya numara ile ara/i);
    await user.type(searchInput, 'Ahmet');

    expect(screen.getByText('Ahmet Yılmaz')).toBeInTheDocument();
    expect(screen.queryByText('Mehmet Demir')).not.toBeInTheDocument();
  });

  it('shows empty state when no students match', () => {
    mockTeacherData([]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <StudentTracking />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Öğrenci bulunamadı')).toBeInTheDocument();
  });
});
