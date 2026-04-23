import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ParentReportsScreen } from './ParentReportsScreen';

vi.mock('../services/backendApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/backendApi')>();
  return {
    ...actual,
    meApi: {
      ...actual.meApi,
      getMyChildren: vi.fn(),
    },
  };
});

const { meApi } = await import('../services/backendApi');

describe('ParentReportsScreen', () => {
  beforeEach(() => {
    vi.mocked(meApi.getMyChildren).mockReset();
  });

  it('shows empty when no exams', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([
      {
        student: {
          id: '1',
          studentNo: '1',
          firstName: 'A',
          lastName: 'B',
          classId: null,
          email: null,
          createdAt: '',
          phone: null,
          notes: null,
        },
        results: [],
      },
    ] as never);

    render(
      <MemoryRouter>
        <ParentReportsScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/henüz sınav verisi bulunmuyor/i)).toBeInTheDocument();
  });

  it('shows summary for child with results', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([
      {
        student: {
          id: '1',
          studentNo: '1',
          firstName: 'Ali',
          lastName: 'Veli',
          classId: null,
          email: null,
          createdAt: '',
          phone: null,
          notes: null,
        },
        results: [
          {
            id: 'r1',
            studentId: '1',
            examId: 'e1',
            examTitle: 'T1',
            correctCount: 10,
            wrongCount: 0,
            wrongTopics: [{ topic: 'X', count: 1 }],
            createdAt: '2025-02-01T10:00:00Z',
          },
        ],
      },
    ] as never);

    render(
      <MemoryRouter>
        <ParentReportsScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/ali veli/i)).toBeInTheDocument();
    expect(screen.getByText(/özet raporlar/i)).toBeInTheDocument();
    expect(screen.getByText(/son sınav özeti/i)).toBeInTheDocument();
  });
});
