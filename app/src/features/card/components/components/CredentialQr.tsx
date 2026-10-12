import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

export function CredentialQr({ value }: { value: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const el = canvas.current;
    if (!el) return;
    el.dataset.ready = 'false';
    setError(false);
    void QRCode.toCanvas(el, value, {
      width: 640,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#061c28', light: '#ffffff' },
    })
      .then(() => {
        if (live) el.dataset.ready = 'true';
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [value]);
  return error ? (
    <span className="credential-qr-unavailable">QR unavailable</span>
  ) : (
    <canvas
      ref={canvas}
      role="img"
      aria-label="Membership verification QR code"
      className="credential-qr-canvas"
    />
  );
}
