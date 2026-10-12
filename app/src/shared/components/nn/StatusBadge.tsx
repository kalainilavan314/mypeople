import { font, radius } from '@/core/theme/tokens';
import { BADGE } from '@/shared/components/nnModel/BADGE';
import { BadgeVariant } from '@/shared/components/nnModel/BadgeVariant';
export function StatusBadge({
  label,
  variant = 'active',
  showDot = false,
}: {
  label: string;
  variant?: BadgeVariant;
  showDot?: boolean;
}) {
  const v = BADGE[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 10px',
        borderRadius: radius.pill,
        background: v.bg,
        color: v.fg,
        font: `700 11px/1 ${font.ui}`,
        letterSpacing: '.2px',
        whiteSpace: 'nowrap',
      }}
    >
      {showDot && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: v.fg, opacity: 0.9 }} />
      )}
      {label}
    </span>
  );
}
