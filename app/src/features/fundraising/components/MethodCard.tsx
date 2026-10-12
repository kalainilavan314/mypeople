import { c, font, radius } from '@/core/theme/tokens';
import { GOLD } from '@/features/fundraising/PartyFund.model';
export function MethodCard({
  emoji,
  title,
  sub,
  active,
  onClick,
}: {
  emoji: string;
  title: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: 14,
        textAlign: 'left',
        background: active ? `${GOLD}14` : c.card,
        cursor: 'pointer',
        border: `${active ? 2 : 1}px solid ${active ? GOLD : c.hairline2}`,
        borderRadius: radius.lg,
        boxShadow: active ? 'none' : 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
      <span style={{ font: `700 14px/1.25 ${font.ta}`, color: active ? c.primary : c.ink }}>
        {title}
      </span>
      <span style={{ font: `400 11.5px/1.4 ${font.ta}`, color: c.ink2 }}>{sub}</span>
    </button>
  );
}
