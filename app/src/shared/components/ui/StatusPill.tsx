import { c, font, radius } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';

export function StatusPill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
  icon?: IconName;
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: c.cardCream, fg: c.ink2 },
    success: { bg: c.sproutSoft, fg: c.success },
    warning: { bg: c.warningBg, fg: c.warning },
    error: { bg: c.errorBg, fg: c.error },
    info: { bg: c.maroonTint, fg: c.maroon },
  };
  const s = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: radius.xs,
        background: s.bg,
        color: s.fg,
        font: `600 12px/1 ${font.ui}`,
      }}
    >
      {icon && <Icon name={icon} size={13} color={s.fg} strokeWidth={2.2} />}
      {label}
    </span>
  );
}
