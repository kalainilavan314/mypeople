import { c, radius, shadow } from '@/core/theme/tokens';
import type { CSSProperties, ReactNode } from 'react';

export function Card({
  children,
  onClick,
  style,
  cream = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  cream?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      style={{
        background: cream ? c.cardCream : c.card,
        border: cream ? 'none' : `1px solid ${c.hairline}`,
        borderRadius: radius.lg,
        boxShadow: cream ? 'none' : shadow.card,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
