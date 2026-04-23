import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ParentHistoryScreen } from './ParentHistoryScreen';

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

describe('ParentHistoryScreen', () => {
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
        <ParentHistoryScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/henüz sınav verisi bulunmuyor/i)).toBeInTheDocument();
  });

  it('lists exam row', async () => {
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
            examTitle: 'Deneme 1',
            correctCount: 8,
            wrongCount: 2,
            wrongTopics: [],
            createdAt: '2025-02-01T10:00:00Z',
          },
        ],
      },
    ] as never);

    render(
      <MemoryRouter>
        <ParentHistoryScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText(/deneme 1/i)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
