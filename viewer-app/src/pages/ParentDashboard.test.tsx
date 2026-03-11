import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParentDashboard } from './ParentDashboard';

vi.mock('../services/backendApi', () => ({
  meApi: {
    getMyChildren: vi.fn(),
  },
}));

const { meApi } = await import('../services/backendApi');

describe('ParentDashboard', () => {
  beforeEach(() => {
    vi.mocked(meApi.getMyChildren).mockReset();
  });

  it('shows empty state when no children', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([]);
    render(<ParentDashboard />);

    expect(await screen.findByText(/henüz bağlı öğrenciniz bulunmuyor/i)).toBeInTheDocument();
  });

  it('shows children with results when data exists', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([
      {
        student: {
          id: '1',
          studentNo: '1001',
          firstName: 'Ahmet',
          lastName: 'Yılmaz',
          classId: null,
          email: null,
          createdAt: '',
        },
        results: [
          {
            id: 'r1',
            correctCount: 8,
            wrongCount: 2,
            createdAt: '2025-01-15T10:00:00Z',
          },
        ],
      },
    ] as never);
    render(<ParentDashboard />);

    expect(await screen.findByText(/ahmet yılmaz/i)).toBeInTheDocument();
    expect(screen.getByText(/doğru: 8 \/ yanlış: 2/i)).toBeInTheDocument();
  });

  it('shows child with no results', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([
      {
        student: {
          id: '1',
          studentNo: '1001',
          firstName: 'Mehmet',
          lastName: 'Demir',
          classId: null,
          email: null,
          createdAt: '',
        },
        results: [],
      },
    ] as never);
    render(<ParentDashboard />);

    expect(await screen.findByText(/mehmet demir/i)).toBeInTheDocument();
    expect(screen.getByText(/henüz sınav sonucu yok/i)).toBeInTheDocument();
  });
});
