import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest, apiGet, ApiError } from './apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('throws ApiError with 401 message when response is 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"message":"Unauthorized"}',
    } as Response);

    await expect(apiRequest('/api/test')).rejects.toMatchObject({
      message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.',
      status: 401,
    } as ApiError);
  });

  it('throws ApiError with body message when response is 400', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"Validation failed"}',
    } as Response);

    await expect(apiRequest('/api/test')).rejects.toMatchObject({
      message: 'Validation failed',
      status: 400,
    } as ApiError);
  });

  it('returns parsed JSON when response is ok', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"id":"1","name":"Test"}',
    } as Response);

    const result = await apiRequest<{ id: string; name: string }>('/api/test');
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('apiGet uses GET method', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '[]',
    } as Response);

    await apiGet('/api/students');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'GET' })
    );
  });
});
