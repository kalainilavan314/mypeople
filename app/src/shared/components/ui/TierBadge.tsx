import { font, radius, tier as tierMap, type Tier } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

export function TierBadge({ tier, onDark = false }: { tier: Tier; onDark?: boolean }) {
  const t = tierMap[tier];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 38,
        padding: '0 13px',
        borderRadius: radius.pill,
        background: onDark ? 'rgba(255,255,255,.16)' : t.soft,
        border: `1px solid ${onDark ? 'rgba(255,255,255,.45)' : t.color}`,
        font: `600 14px/1 ${font.ta}`,
        color: onDark ? '#FFFFFF' : t.color,
      }}
    >
      <Icon
        name="sprout"
        size={16}
        color={onDark ? 'rgba(255,255,255,.9)' : t.color}
        strokeWidth={2}
      />
      {t.nameTa} · {t.nameEn}
    </span>
  );
}
