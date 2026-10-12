import { authC } from '@/core/theme/tokens';
import { type ReactNode } from 'react';

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100%',
        background: authC.bg,
        color: authC.text,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .auth input::placeholder { color: ${authC.text3}; opacity: 1; }
        .auth input:-webkit-autofill,
        .auth input:-webkit-autofill:focus {
          -webkit-text-fill-color: ${authC.text};
          -webkit-box-shadow: 0 0 0 60px ${authC.field} inset;
          caret-color: ${authC.text};
        }
      `}</style>
      <div
        className="auth"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}
