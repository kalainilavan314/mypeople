import { c, radius, shadow } from '@/core/theme/tokens';

export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100% - 32px, 416px)',
          margin: '0 16px calc(16px + var(--safe-bottom))',
          background: c.card,
          borderRadius: radius.xxl,
          padding: 24,
          boxShadow: shadow.lg,
        }}
      >
        {children}
      </div>
    </div>
  );
}
