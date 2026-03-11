import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Reports } from './Reports';

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

vi.mock('../contexts/TeacherDataContext', () => ({
  useTeacherData: vi.fn(),
}));

const { useTeacherData } = await import('../contexts/TeacherDataContext');

function mockTeacherData() {
  vi.mocked(useTeacherData).mockReturnValue({
    students: [{ id: '1', classId: null }],
    classes: [{ id: '1', name: '8-A', grade: 8 }],
    analyses: [],
    exams: [],
    examResults: [],
    getStudentsByClass: () => [],
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
    deleteAnalysis: async () => {},
    addExam: async () => ({} as never),
    updateExam: async () => {},
    getExamByAnalysisId: () => undefined,
    getResultsByExam: () => [],
    getResultsByStudent: () => [],
    getClassById: () => undefined,
    getStudentById: () => undefined,
  } as never);
}

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats and charts', () => {
    mockTeacherData();
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    expect(screen.getByText('Raporlar')).toBeInTheDocument();
    expect(screen.getByText(/genel istatistikler/i)).toBeInTheDocument();
  });

  it('renders Excel export button and triggers export on click', async () => {
    mockTeacherData();
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    const exportBtn = screen.getByRole('button', { name: /excel.*aktar/i });
    expect(exportBtn).toBeInTheDocument();

    await userEvent.click(exportBtn);

    const xlsx = await import('xlsx');
    expect(xlsx.writeFile).toHaveBeenCalled();
  });
});
