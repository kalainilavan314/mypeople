import { authC, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

export function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        border: `1px solid ${authC.line}`,
        background: authC.surface,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(35,55,80,.06)',
      }}
    >
      <Icon name="chevronLeft" size={22} color={authC.text} strokeWidth={2} />
    </button>
  );
}
