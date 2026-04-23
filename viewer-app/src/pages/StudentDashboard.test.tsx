import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboard } from './StudentDashboard';

vi.mock('../services/backendApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/backendApi')>();
  return {
    ...actual,
    meApi: {
      ...actual.meApi,
      getMyResults: vi.fn(),
      getMyExams: vi.fn(),
    },
  };
});

const { meApi } = await import('../services/backendApi');

describe('StudentDashboard', () => {
  beforeEach(() => {
    vi.mocked(meApi.getMyResults).mockReset();
    vi.mocked(meApi.getMyExams).mockReset();
    vi.mocked(meApi.getMyExams).mockResolvedValue([]);
  });

  it('shows empty state when no results', async () => {
    vi.mocked(meApi.getMyResults).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <StudentDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText(/henüz sınav sonucunuz bulunmuyor/i)).toBeInTheDocument();
  });

  it('shows results when data exists', async () => {
    vi.mocked(meApi.getMyResults).mockResolvedValue([
      {
        id: '1',
        studentId: 's1',
        examId: 'e1',
        correctCount: 8,
        wrongCount: 2,
        wrongTopics: [{ topic: 'Fiilimsiler', count: 2 }],
        createdAt: '2025-01-15T10:00:00Z',
      },
    ] as never);
    render(
      <MemoryRouter>
        <StudentDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText(/doğru: 8 \/ yanlış: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/fiilimsiler/i)).toBeInTheDocument();
  });
});
