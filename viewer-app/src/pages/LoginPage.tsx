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
  const { login, loginDemo, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard', { replace: true });
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
      const success = await loginDemo();
      if (success) {
        navigate('/dashboard', { replace: true });
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
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-3 bg-primary bg-opacity-10 text-primary mb-3"
            style={{ width: 64, height: 64 }}
          >
            <i className="bi bi-mortarboard-fill fs-2" aria-hidden />
          </div>
          <h2 className="fw-bold mb-1">EduAnalyzer</h2>
          <p className="text-muted mb-0">Sınav Analiz Paneli</p>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <h5 className="fw-semibold mb-3">Öğretmen Girişi</h5>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">
                <i className="bi bi-exclamation-circle me-2" />
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">E-posta</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@okul.edu.tr"
                  disabled={loading}
                  autoComplete="email"
                  size="lg"
                />
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label className="fw-medium">Şifre</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  size="lg"
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
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
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

            <Button
              variant="outline-primary"
              size="lg"
              className="w-100"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              <i className="bi bi-lightning-charge me-2" />
              Demo Giriş
            </Button>
            <p className="text-center text-muted small mt-3 mb-0">
              E-posta ve şifre girmeden tek tıkla giriş
            </p>
          </Card.Body>
        </Card>

        <p className="text-center text-muted small mt-3">
          Demo: ogretmen@demo.com / demo123
        </p>
      </div>
    </div>
  );
}
