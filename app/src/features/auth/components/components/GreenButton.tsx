import { radius } from '@/core/theme/tokens';
import { type CSSProperties, type ReactNode } from 'react';

export function GreenButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: CSSProperties;
}) {
  const off = disabled || loading;
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      disabled={off}
      style={{
        width: '100%',
        height: 52,
        borderRadius: radius.pill,
        border: 'none',
        background: off ? '#94A3B8' : 'var(--primary)',
        color: '#ffffff',
        font: `700 15.5px/1 var(--font-ui, sans-serif)`,
        letterSpacing: 'normal',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: off ? 'not-allowed' : 'pointer',
        boxShadow: off ? 'none' : '0 10px 24px -4px rgba(20, 38, 61, 0.42)',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        ...style,
      }}
    >
      {loading && (
        <span
          className="auth-spin"
          style={{
            width: 18,
            height: 18,
            border: '2.5px solid rgba(255,255,255,.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'authSpin 700ms linear infinite',
          }}
        />
      )}
      {children}
      <style>{'@keyframes authSpin{to{transform:rotate(360deg)}}'}</style>
    </button>
  );
}
