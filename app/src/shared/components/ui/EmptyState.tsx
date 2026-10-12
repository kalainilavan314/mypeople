import { c, font, radius } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';

export function EmptyState({
  icon = 'report',
  title,
  sub,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.lg,
          background: c.maroonTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={26} color={c.maroon} />
      </div>
      <div style={{ font: `600 16px/1.4 ${font.ta}`, color: c.ink }}>{title}</div>
      {sub && (
        <div style={{ font: `400 13px/1.5 ${font.ui}`, color: c.ink3, maxWidth: 260 }}>{sub}</div>
      )}
    </div>
  );
}
