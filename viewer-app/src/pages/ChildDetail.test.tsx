import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChildDetail } from './ChildDetail';

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

describe('ChildDetail', () => {
  beforeEach(() => {
    vi.mocked(meApi.getMyChildren).mockReset();
  });

  it('shows not found state when child id is not owned', async () => {
    vi.mocked(meApi.getMyChildren).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/parent/student/s1']}>
        <Routes>
          <Route path="/parent/student/:id" element={<ChildDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/öğrenci bulunamadı/i)).toBeInTheDocument();
  });
});
