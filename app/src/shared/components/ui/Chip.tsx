import { c, ease, font, radius } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';

export function Chip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: IconName;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 44,
        padding: '0 16px',
        flex: 'none',
        borderRadius: radius.pill,
        cursor: 'pointer',
        border: `1px solid ${active ? c.maroon : c.hairline2}`,
        background: active ? c.maroon : c.card,
        color: active ? '#FFFFFF' : c.ink0,
        font: `600 14px/1 ${font.ta}`,
        transition: `all 160ms ${ease}`,
      }}
    >
      {icon && <Icon name={icon} size={15} color={active ? '#FFFFFF' : c.ink2} />}
      {label}
    </button>
  );
}
