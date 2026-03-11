/**
 * Kamera ile fotoğraf çekme bileşeni
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button, Card } from 'react-bootstrap';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kamera açılamadı.';
      setError(msg);
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.srcObject || video.readyState !== 4) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          stopStream();
        }
      },
      'image/jpeg',
      0.9
    );
  }, [onCapture, stopStream]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-4">
          <i className="bi bi-camera-video-off text-muted fs-1 d-block mb-2" />
          <p className="text-muted small mb-2">{error}</p>
          <Button variant="outline-primary" size="sm" onClick={startCamera}>
            Tekrar Dene
          </Button>
        </Card.Body>
      </Card>
    );
  }

  if (active) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <div className="position-relative rounded overflow-hidden bg-dark mb-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-100"
              style={{ maxHeight: 300 }}
              aria-label="Kamera önizlemesi"
            />
          </div>
          <div className="d-flex gap-2">
            <Button variant="primary" onClick={capture} aria-label="Fotoğrafı çek">
              <i className="bi bi-camera-fill me-2" />
              Fotoğrafı Çek
            </Button>
            <Button variant="secondary" onClick={stopStream}>
              İptal
            </Button>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Button
      variant="outline-primary"
      onClick={startCamera}
      disabled={disabled}
      aria-label="Kamera ile aç"
    >
      <i className="bi bi-camera-fill me-2" />
      Kamera ile Çek
    </Button>
  );
}
