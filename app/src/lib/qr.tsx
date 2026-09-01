import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRProps {
  value: string;
  size?: number;
  dark?: string;
  light?: string;
}

/**
 * Real, scannable QR (unlike the prototype's decorative pattern).
 * For check-in this encodes `member_code|qr_nonce`; the nonce is single-use per event.
 */
export function QR({ value, size = 160, dark = '#1A2E2A', light = '#FFFFFF' }: QRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 0,
      color: { dark, light },
      errorCorrectionLevel: 'M',
    });
  }, [value, size, dark, light]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block', borderRadius: 6 }}
      role="img"
      aria-label="QR code"
    />
  );
}

/** Build a rotating single-use check-in token. Real nonce comes from the server per event. */
export function checkInToken(memberCode: string, eventId: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${memberCode}|${eventId}|${nonce}`;
}
