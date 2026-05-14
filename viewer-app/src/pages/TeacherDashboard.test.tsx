import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeacherDashboard } from './TeacherDashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useAuth } = await import('../contexts/AuthContext');
const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockAuth(user: { displayName: string }) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: '1', email: 't@t.com', displayName: user.displayName, role: 'Teacher' },
    isAuthenticated: true,
    login: async () => null,
    loginDemo: async () => null,
    loginDemoParent: async () => null,
    logout: () => {},
  } as never);
}

function mockTeacherData(data: { students?: unknown[]; classes?: unknown[]; analyses?: unknown[] }) {
  vi.mocked(useTeacherData).mockReturnValue({
    students: data.students ?? [],
    classes: data.classes ?? [],
    analyses: data.analyses ?? [],
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
    getClassById: () => undefined,
    getStudentById: () => undefined,
  } as never);
}

describe('TeacherDashboard', () => {
  it('renders welcome message and stats', () => {
    mockAuth({ displayName: 'Demo Öğretmen' });
    mockTeacherData({ students: [], classes: [], analyses: [] });

    render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/hoş geldiniz, demo öğretmen/i)).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('Öğrenci')).toBeInTheDocument();
    expect(screen.getByText('Özellikler')).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    mockAuth({ displayName: 'Test' });
    mockTeacherData({ students: [], classes: [], analyses: [] });

    render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Öğrenci Takibi')).toBeInTheDocument();
    expect(screen.getByText(/pdf'den sınav analizi/i)).toBeInTheDocument();
    expect(screen.getByText('Tek Soru Analizi')).toBeInTheDocument();
  });

  it('shows correct counts when data exists', () => {
    mockAuth({ displayName: 'Test' });
    mockTeacherData({
      students: [{ id: '1' }, { id: '2' }] as never[],
      classes: [{ id: '1' }] as never[],
      analyses: [{ analyzedQuestions: 5 }, { analyzedQuestions: 3 }] as never[],
    });

    render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>
    );

    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
  });
});
