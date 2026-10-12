import { font, radius, shadow } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';

export function QuickTile({
  icon,
  label,
  sublabel,
  gradient,
  onClick,
}: {
  icon: IconName;
  label: string;
  sublabel: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        background: gradient,
        border: 'none',
        borderRadius: radius.xl,
        padding: 16,
        cursor: 'pointer',
        minHeight: 118,
        boxSizing: 'border-box',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 14,
        boxShadow: shadow.tile,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'rgba(255,255,255,.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color="#fff" strokeWidth={1.9} />
      </span>
      <span>
        <span style={{ display: 'block', font: `700 15px/1.2 ${font.head}`, color: '#fff' }}>
          {label}
        </span>
        <span
          style={{
            display: 'block',
            font: `400 11px/1.35 ${font.ui}`,
            color: 'rgba(255,255,255,.8)',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sublabel}
        </span>
      </span>
    </button>
  );
}
