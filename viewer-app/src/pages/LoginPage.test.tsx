import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { LoginPage } from './LoginPage';

vi.mock('../services/backendApi', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

const { authApi } = await import('../services/backendApi');

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset();
  });

  it('renders login form with email and password fields', () => {
    renderLoginPage();
    expect(screen.getByPlaceholderText('ornek@okul.edu.tr')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /giriş yap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /öğretmen demo/i })).toBeInTheDocument();
  });

  it('shows error when login fails', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Unauthorized'));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText('ornek@okul.edu.tr'), 'wrong@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong');
    await user.click(screen.getByRole('button', { name: /giriş yap/i }));
    expect(await screen.findByText(/geçersiz e-posta veya şifre/i)).toBeInTheDocument();
  });

  it('calls login with demo credentials on demo button click', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresAt: new Date().toISOString(),
      user: { id: '1', email: 'ogretmen@demo.com', displayName: 'Demo', role: 'Teacher' },
    } as never);
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /öğretmen demo/i }));
    expect(authApi.login).toHaveBeenCalledWith('ogretmen@demo.com', 'demo123');
  });
});
