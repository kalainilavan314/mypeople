import { c, font, radius } from '@/core/theme/tokens';

export function ChipRow({
  items,
  selected,
  onSelect,
}: {
  items: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div
      className="nn-scroll"
      style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 2px' }}
    >
      {items.map((label, i) => {
        const on = i === selected;
        return (
          <button
            key={label}
            onClick={() => onSelect(i)}
            style={{
              flex: 'none',
              height: 40,
              padding: '0 18px',
              borderRadius: radius.pill,
              cursor: 'pointer',
              background: on ? c.primary : 'transparent',
              border: `1.5px solid ${on ? c.primary : c.hairline2}`,
              color: on ? '#fff' : c.ink2,
              font: `600 13px/1 ${font.ui}`,
              transition:
                'background 200ms var(--ease), color 200ms var(--ease), border-color 200ms var(--ease)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
