import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ParentAnalysisScreen } from './ParentAnalysisScreen';

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

describe('ParentAnalysisScreen', () => {
  beforeEach(() => {
    vi.mocked(meApi.getMyChildren).mockReset();
  });

  it('shows empty state when no exam data', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([
      {
        student: {
          id: '1',
          studentNo: '1001',
          firstName: 'Ali',
          lastName: 'Veli',
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
        <ParentAnalysisScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/henüz sınav verisi bulunmuyor/i)).toBeInTheDocument();
  });

  it('shows child name and chart section when results exist', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([
      {
        student: {
          id: '1',
          studentNo: '1001',
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
            correctCount: 10,
            wrongCount: 0,
            wrongTopics: [{ topic: 'Matematik', count: 1 }],
            createdAt: '2025-01-15T10:00:00Z',
          },
        ],
      },
    ] as never);

    render(
      <MemoryRouter>
        <ParentAnalysisScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/ali veli/i)).toBeInTheDocument();
    expect(screen.getByText(/daha fazla sınav ile daha doğru analiz/i)).toBeInTheDocument();
    expect(screen.getByText(/net ve başarı yüzdesi/i)).toBeInTheDocument();
    expect(screen.getByText(/matematik/i)).toBeInTheDocument();
  });
});
