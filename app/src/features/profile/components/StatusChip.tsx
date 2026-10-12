import { c, font, radius, type as ty } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

export function StatusChip({
  good,
  warn,
  label,
}: {
  good?: boolean;
  warn?: boolean;
  label: string;
}) {
  const color = good ? c.success : warn ? c.warning : c.ink3;
  const bg = good ? c.successBg : warn ? c.warningBg : c.surfaceVariant;
  return (
    <span
      style={{
        display: 'inline-flex',
        minWidth: 0,
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: radius.xs,
        background: bg,
        color,
        font: `600 ${ty.caption.size / 16}rem/1.65 ${font.ui}`,
      }}
    >
      <Icon name={good ? 'check' : 'info'} size={12} strokeWidth={2.6} />
      {label}
    </span>
  );
}
