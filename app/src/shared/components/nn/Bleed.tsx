import { type ReactNode } from 'react';

export function Bleed({ children }: { children: ReactNode }) {
  return (
    <div
      className="nn-scroll"
      style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 4px' }}
    >
      {children}
    </div>
  );
}
