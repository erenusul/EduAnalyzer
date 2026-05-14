/**
 * Öğretmen giriş sayfası (mock)
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, loginDemo, loginDemoParent, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const path =
        user.role === 'Teacher' ? '/dashboard' : user.role === 'Student' ? '/student' : '/parent';
      navigate(path, { replace: true });
    } else if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  const getPathForRole = (role?: string) =>
    role === 'Teacher'
      ? '/dashboard'
      : role === 'Student'
        ? '/student'
        : role === 'Parent'
          ? '/parent'
          : '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const userData = await login(email, password);
      if (userData) {
        navigate(getPathForRole(userData.role), { replace: true });
      } else {
        setError('Geçersiz e-posta veya şifre.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const userData = await loginDemo();
      if (userData) {
        navigate(getPathForRole(userData.role), { replace: true });
      } else {
        setError('Demo girişi başarısız. Backend çalışıyor mu?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="w-100" style={{ maxWidth: 420 }}>
        <div className="text-center mb-4">
          <div style={{ marginTop: '0px', marginBottom: '-60px' }}>
            <img 
              src="/edulyzer_logo_gri.png" 
              alt="EduAnalyzer Logo" 
              style={{ height: '280px', width: 'auto', objectFit: 'contain' }} 
            />
          </div>
          <p className="text-muted mb-0">Sınav Analiz Paneli</p>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <h5 className="fw-semibold mb-3">Giriş</h5>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">
                <i className="bi bi-exclamation-circle me-2" />
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="login-email" className="fw-medium">
                  E-posta
                </Form.Label>
                <Form.Control
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@okul.edu.tr"
                  disabled={loading}
                  autoComplete="email"
                  size="lg"
                  aria-label="E-posta adresi"
                />
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label htmlFor="login-password" className="fw-medium">
                  Şifre
                </Form.Label>
                <Form.Control
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  size="lg"
                  aria-label="Şifre"
                />
              </Form.Group>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-100 mb-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden
                    />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </Form>

            <div className="position-relative my-3">
              <hr />
              <span className="position-absolute top-50 start-50 translate-middle bg-white px-2 text-muted small">
                veya
              </span>
            </div>

            <div className="d-flex flex-column gap-2">
              <Button
                variant="outline-primary"
                size="lg"
                className="w-100"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                <i className="bi bi-lightning-charge me-2" />
                Öğretmen Hızlı Giriş
              </Button>
              <Button
                variant="outline-secondary"
                size="lg"
                className="w-100"
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const userData = await loginDemoParent();
                    if (userData) navigate(getPathForRole(userData.role), { replace: true });
                    else setError('Demo girişi başarısız.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                <i className="bi bi-people me-2" />
                Veli Hızlı Giriş
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
