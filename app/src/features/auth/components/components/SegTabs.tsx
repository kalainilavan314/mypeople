import { authC, font, radius } from '@/core/theme/tokens';

export function SegTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (k: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 5,
        borderRadius: radius.md,
        background: authC.surface2,
      }}
    >
      {tabs.map((tb) => {
        const on = tb.key === active;
        return (
          <button
            key={tb.key}
            type="button"
            onClick={() => onSelect(tb.key)}
            aria-pressed={on}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.sm,
              cursor: 'pointer',
              border: 'none',
              background: on ? authC.surface : 'transparent',
              color: on ? authC.green : authC.text2,
              font: `700 15px/1 ${font.ui}`,
              boxShadow: on ? '0 2px 8px rgba(20,38,61,.18)' : 'none',
              transition: 'background 180ms ease, color 180ms ease',
            }}
          >
            {tb.label}
          </button>
        );
      })}
    </div>
  );
}
