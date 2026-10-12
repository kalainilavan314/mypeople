import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

export function HeaderChipButton({
  icon,
  label,
  onClick,
}: {
  icon: 'camera' | 'image';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,.25)',
        background: 'rgba(255,255,255,.10)',
        color: '#fff',
        cursor: 'pointer',
        font: `600 12px/1 ${font.ta}`,
      }}
    >
      <Icon name={icon} size={14} color="#fff" strokeWidth={2} />
      {label}
    </button>
  );
}
