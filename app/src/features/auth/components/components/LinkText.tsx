import { authC, font } from '@/core/theme/tokens';
import { type ReactNode } from 'react';

export function LinkText({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        font: `600 13px/1.4 ${font.ui}`,
        color: authC.green,
      }}
    >
      {children}
    </button>
  );
}
