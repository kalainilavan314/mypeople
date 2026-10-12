import { c, ease, radius } from '@/core/theme/tokens';

export function Toggle({
  on,
  onChange,
  ariaLabel,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      style={{
        width: 48,
        height: 44,
        borderRadius: radius.pill,
        background: on ? c.maroon : c.hairline2,
        padding: 11,
        alignItems: 'center',
        border: 'none',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        flex: 'none',
        cursor: 'pointer',
        transition: `all 160ms ${ease}`,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.pill,
          background: '#FFFFFF',
          display: 'block',
        }}
      />
    </button>
  );
}
